import { trainRandomForest, predictRF, accuracyScore, confusionMatrix } from './randomForest'

function uniq(arr) {
  return Array.from(new Set(arr))
}

function majorityLabel(labels) {
  const counts = {}
  labels.forEach((label) => {
    counts[label] = (counts[label] || 0) + 1
  })
  return Object.keys(counts).reduce((best, label) => (
    counts[label] > (counts[best] || 0) ? label : best
  ), labels[0] || 'ok')
}

function gini(labels) {
  const counts = {}
  labels.forEach((label) => {
    counts[label] = (counts[label] || 0) + 1
  })
  const n = labels.length || 1
  let score = 1
  for (const key in counts) {
    const p = counts[key] / n
    score -= p * p
  }
  return score
}

function normalizeFeatures(X) {
  const nFeatures = X[0]?.length || 0
  const means = new Array(nFeatures).fill(0)
  const stds = new Array(nFeatures).fill(1)

  for (const row of X) {
    for (let j = 0; j < nFeatures; j += 1) {
      means[j] += row[j]
    }
  }

  for (let j = 0; j < nFeatures; j += 1) {
    means[j] /= X.length || 1
  }

  for (const row of X) {
    for (let j = 0; j < nFeatures; j += 1) {
      stds[j] += (row[j] - means[j]) ** 2
    }
  }

  for (let j = 0; j < nFeatures; j += 1) {
    stds[j] = Math.sqrt(stds[j] / (X.length || 1)) || 1
  }

  const normalized = X.map((row) => row.map((value, j) => (value - means[j]) / stds[j]))
  return { normalized, means, stds }
}

function argMaxIndex(arr) {
  let best = 0
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i] > arr[best]) best = i
  }
  return best
}

function softmax(vec) {
  const max = Math.max(...vec)
  const exps = vec.map((v) => Math.exp(v - max))
  const sum = exps.reduce((s, v) => s + v, 0) || 1
  return exps.map((v) => v / sum)
}

function inferClasses(y) {
  return Array.from(new Set(y))
}

function classWeights(y, classes) {
  const counts = Object.fromEntries(classes.map((c) => [c, 0]))
  y.forEach((label) => {
    if (counts[label] !== undefined) counts[label] += 1
  })

  const total = y.length || 1
  const weights = Object.fromEntries(classes.map((c) => [c, 1]))
  classes.forEach((c) => {
    const count = counts[c] || 1
    weights[c] = total / (classes.length * count)
  })
  return weights
}

function buildTree(X, y, depth, opts, importance) {
  const maxDepth = opts.maxDepth ?? 6
  const minSamplesSplit = opts.minSamplesSplit ?? 2
  const nFeatures = X[0]?.length || 0

  if (!X.length) return { isLeaf: true, value: 'ok' }

  const pure = y.every((label) => label === y[0])
  if (pure || depth >= maxDepth || X.length < minSamplesSplit) {
    return { isLeaf: true, value: majorityLabel(y) }
  }

  const baseImpurity = gini(y)
  let best = null

  for (let f = 0; f < nFeatures; f += 1) {
    const values = uniq(X.map((row) => row[f])).sort((a, b) => a - b)
    if (values.length <= 1) continue

    for (let i = 0; i < values.length - 1; i += 1) {
      const threshold = (values[i] + values[i + 1]) / 2
      const leftX = []
      const leftY = []
      const rightX = []
      const rightY = []

      for (let r = 0; r < X.length; r += 1) {
        if (X[r][f] <= threshold) {
          leftX.push(X[r])
          leftY.push(y[r])
        } else {
          rightX.push(X[r])
          rightY.push(y[r])
        }
      }

      if (!leftX.length || !rightX.length) continue

      const weightedImpurity =
        (leftY.length / X.length) * gini(leftY) +
        (rightY.length / X.length) * gini(rightY)

      const gain = baseImpurity - weightedImpurity
      if (!best || gain > best.gain) {
        best = { feature: f, threshold, leftX, leftY, rightX, rightY, gain }
      }
    }
  }

  if (!best || best.gain <= 0) {
    return { isLeaf: true, value: majorityLabel(y) }
  }

  importance[best.feature] += best.gain

  return {
    isLeaf: false,
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(best.leftX, best.leftY, depth + 1, opts, importance),
    right: buildTree(best.rightX, best.rightY, depth + 1, opts, importance),
  }
}

function predictTreeRow(tree, row) {
  let node = tree
  while (!node.isLeaf) {
    node = row[node.feature] <= node.threshold ? node.left : node.right
  }
  return node.value
}

export function trainDecisionTree(X, y, opts = {}) {
  const featureCount = X[0]?.length || 0
  const importance = new Array(featureCount).fill(0)
  const tree = buildTree(X, y, 0, opts, importance)
  const total = importance.reduce((s, v) => s + v, 0) || 1

  return {
    tree,
    importance: importance.map((v) => v / total),
  }
}

export function predictDecisionTree(model, X) {
  return X.map((row) => predictTreeRow(model.tree, row))
}

export function trainLogisticRegression(X, y, opts = {}) {
  const classes = inferClasses(y)
  const classIndex = Object.fromEntries(classes.map((label, index) => [label, index]))
  const weightsByClass = classWeights(y, classes)
  const { normalized, means, stds } = normalizeFeatures(X)
  const nFeatures = X[0]?.length || 0
  const nClasses = classes.length
  const epochs = opts.epochs ?? 500
  const learningRate = opts.learningRate ?? 0.04
  const l2 = opts.l2 ?? 0.0015
  const patience = opts.patience ?? 18

  let weights = Array.from({ length: nClasses }, () => new Array(nFeatures).fill(0))
  let bias = new Array(nClasses).fill(0)
  let bestWeights = weights.map((row) => row.slice())
  let bestBias = bias.slice()
  let bestLoss = Infinity
  let stale = 0

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW = Array.from({ length: nClasses }, () => new Array(nFeatures).fill(0))
    const gradB = new Array(nClasses).fill(0)
    let epochLoss = 0

    for (let i = 0; i < normalized.length; i += 1) {
      const row = normalized[i]
      const scores = classes.map((_, c) => {
        let sum = bias[c]
        for (let j = 0; j < nFeatures; j += 1) {
          sum += weights[c][j] * row[j]
        }
        return sum
      })

      const probs = softmax(scores)
      const target = classIndex[y[i]]
      const sampleWeight = weightsByClass[y[i]] || 1
      epochLoss += -Math.log((probs[target] || 1e-12)) * sampleWeight

      for (let c = 0; c < nClasses; c += 1) {
        const error = (probs[c] - (c === target ? 1 : 0)) * sampleWeight
        for (let j = 0; j < nFeatures; j += 1) {
          gradW[c][j] += error * row[j]
        }
        gradB[c] += error
      }
    }

    for (let c = 0; c < nClasses; c += 1) {
      for (let j = 0; j < nFeatures; j += 1) {
        const reg = l2 * weights[c][j]
        weights[c][j] -= learningRate * ((gradW[c][j] / normalized.length) + reg)
      }
      bias[c] -= learningRate * (gradB[c] / normalized.length)
    }

    const avgLoss = epochLoss / (normalized.length || 1)
    if (avgLoss + 1e-5 < bestLoss) {
      bestLoss = avgLoss
      bestWeights = weights.map((row) => row.slice())
      bestBias = bias.slice()
      stale = 0
    } else {
      stale += 1
    }

    if (stale >= patience) break
  }

  weights = bestWeights
  bias = bestBias

  const importance = new Array(nFeatures).fill(0)
  for (let j = 0; j < nFeatures; j += 1) {
    importance[j] = weights.reduce((sum, classWeights) => sum + Math.abs(classWeights[j]), 0)
  }
  const totalImportance = importance.reduce((s, v) => s + v, 0) || 1

  return {
    weights,
    bias,
    means,
    stds,
    classes,
    importance: importance.map((v) => v / totalImportance),
  }
}

export function predictLogisticRegression(model, X) {
  return X.map((row) => {
    const normalized = row.map((value, j) => (value - model.means[j]) / model.stds[j])
    const scores = model.classes.map((_, c) => {
      let sum = model.bias[c]
      for (let j = 0; j < normalized.length; j += 1) {
        sum += model.weights[c][j] * normalized[j]
      }
      return sum
    })
    const probs = softmax(scores)
    return model.classes[argMaxIndex(probs)]
  })
}

export {
  trainRandomForest,
  predictRF,
  accuracyScore,
  confusionMatrix,
}


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

function majorityLabel(labels) {
  const counts = {}
  labels.forEach((label) => {
    counts[label] = (counts[label] || 0) + 1
  })

  return Object.keys(counts).reduce((best, label) => (
    counts[label] > (counts[best] || 0) ? label : best
  ), labels[0] || 'ok')
}

function uniq(arr) {
  return Array.from(new Set(arr))
}

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function bootstrapIndices(n, sampleRatio) {
  const sampleSize = Math.max(1, Math.floor(n * sampleRatio))
  return Array.from({ length: sampleSize }, () => Math.floor(Math.random() * n))
}

function featureSubset(nFeatures, mFeatures) {
  const pool = Array.from({ length: nFeatures }, (_, i) => i)
  const picked = []

  while (picked.length < mFeatures && pool.length) {
    const index = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }

  return picked
}

function bestSplit(X, y, featureIndices) {
  const baseImpurity = gini(y)
  let best = null

  for (const feature of featureIndices) {
    const values = uniq(X.map((row) => row[feature])).sort((a, b) => a - b)
    if (values.length <= 1) continue

    for (let i = 0; i < values.length - 1; i += 1) {
      const threshold = (values[i] + values[i + 1]) / 2
      const leftY = []
      const rightY = []

      for (let r = 0; r < X.length; r += 1) {
        if (X[r][feature] <= threshold) {
          leftY.push(y[r])
        } else {
          rightY.push(y[r])
        }
      }

      if (!leftY.length || !rightY.length) continue

      const weightedImpurity =
        (leftY.length / X.length) * gini(leftY) +
        (rightY.length / X.length) * gini(rightY)

      const gain = baseImpurity - weightedImpurity
      if (!best || gain > best.gain) {
        best = {
          feature,
          threshold,
          gain,
          leftX: X.filter((_, idx) => X[idx][feature] <= threshold),
          leftY,
          rightX: X.filter((_, idx) => X[idx][feature] > threshold),
          rightY,
        }
      }
    }
  }

  return best
}

function buildTree(X, y, depth, opts, importance) {
  const maxDepth = opts.maxDepth ?? 5
  const minSamplesSplit = opts.minSamplesSplit ?? 3
  const featureRatio = opts.featureRatio ?? Math.sqrt(X[0]?.length || 0)
  const nFeatures = X[0]?.length || 0

  if (!X.length) {
    return { isLeaf: true, value: 'ok' }
  }

  const pure = y.every((label) => label === y[0])
  if (pure || depth >= maxDepth || X.length < minSamplesSplit) {
    return { isLeaf: true, value: majorityLabel(y) }
  }

  const mFeatures = Math.max(1, Math.min(nFeatures, Math.round(featureRatio)))
  const candidateFeatures = featureSubset(nFeatures, mFeatures)
  const split = bestSplit(X, y, candidateFeatures)

  if (!split || split.gain <= 0) {
    return { isLeaf: true, value: majorityLabel(y) }
  }

  importance[split.feature] += split.gain

  return {
    isLeaf: false,
    feature: split.feature,
    threshold: split.threshold,
    left: buildTree(split.leftX, split.leftY, depth + 1, opts, importance),
    right: buildTree(split.rightX, split.rightY, depth + 1, opts, importance),
  }
}

function predictTreeRow(tree, row) {
  let node = tree
  while (!node.isLeaf) {
    node = row[node.feature] <= node.threshold ? node.left : node.right
  }
  return node.value
}

export function trainRandomForest(X, y, opts = {}) {
  const nEstimators = opts.nEstimators || 50
  const sampleRatio = opts.sampleRatio || 0.85
  const maxDepth = opts.maxDepth || 5
  const minSamplesSplit = opts.minSamplesSplit || 3
  const featureRatio = opts.featureRatio || Math.sqrt(X[0]?.length || 0)
  const nFeatures = X[0]?.length || 0
  const trees = []
  const importances = new Array(nFeatures).fill(0)

  if (!X.length) {
    return { trees: [], importance: importances }
  }

  for (let t = 0; t < nEstimators; t += 1) {
    const idx = bootstrapIndices(X.length, sampleRatio)
    const Xs = idx.map((i) => X[i])
    const ys = idx.map((i) => y[i])

    const treeImportance = new Array(nFeatures).fill(0)
    const tree = buildTree(Xs, ys, 0, { maxDepth, minSamplesSplit, featureRatio }, treeImportance)

    for (let j = 0; j < nFeatures; j += 1) {
      importances[j] += treeImportance[j]
    }

    trees.push(tree)
  }

  const total = importances.reduce((s, v) => s + v, 0) || 1
  const importance = importances.map((v) => v / total)

  return { trees, importance }
}

export function predictRF(model, X) {
  return X.map((row) => {
    const votes = {}

    for (const tree of model.trees || []) {
      const pred = predictTreeRow(tree, row)
      votes[pred] = (votes[pred] || 0) + 1
    }

    const labels = Object.keys(votes)
    if (!labels.length) return 'ok'
    return labels.reduce((best, label) => (votes[label] > votes[best] ? label : best), labels[0])
  })
}

export function accuracyScore(yTrue, yPred) {
  if (!yTrue.length) return 0
  let ok = 0
  for (let i = 0; i < yTrue.length; i += 1) {
    if (String(yTrue[i]) === String(yPred[i])) ok += 1
  }
  return ok / yTrue.length
}

export function confusionMatrix(labels, yTrue, yPred) {
  const uniqLabels = Array.from(new Set(labels))
  const idx = Object.fromEntries(uniqLabels.map((label, i) => [label, i]))
  const mat = Array.from({ length: uniqLabels.length }, () => Array(uniqLabels.length).fill(0))

  for (let i = 0; i < yTrue.length; i += 1) {
    const a = idx[yTrue[i]]
    const b = idx[yPred[i]]
    if (a !== undefined && b !== undefined) {
      mat[a][b] += 1
    }
  }

  return { labels: uniqLabels, matrix: mat }
}


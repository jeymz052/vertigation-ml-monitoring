// Minimal Random Forest classifier using decision stumps (depth=1) for browser-side prototyping
function gini(labels) {
  const counts = {}
  labels.forEach(l => counts[l] = (counts[l] || 0) + 1)
  const n = labels.length
  let score = 1
  for (const k in counts) {
    const p = counts[k] / n
    score -= p * p
  }
  return score
}

function uniq(arr) {
  return Array.from(new Set(arr))
}

export function trainRandomForest(X, y, opts = {}) {
  const nEstimators = opts.nEstimators || 25
  const sampleRatio = opts.sampleRatio || 1.0
  const nFeatures = X[0]?.length || 0
  const mFeatures = Math.max(1, Math.round(Math.sqrt(nFeatures)))

  const trees = []
  const importances = new Array(nFeatures).fill(0)

  for (let t = 0; t < nEstimators; t++) {
    // bootstrap sample
    const nSamples = Math.max(1, Math.floor(X.length * sampleRatio))
    const idx = Array.from({ length: nSamples }, () => Math.floor(Math.random() * X.length))
    const Xs = idx.map(i => X[i])
    const ys = idx.map(i => y[i])

    const baseImpurity = gini(ys)

    // select random subset of features
    const featIndices = []
    const allIdx = Array.from({ length: nFeatures }, (_, i) => i)
    while (featIndices.length < mFeatures && allIdx.length) {
      const r = Math.floor(Math.random() * allIdx.length)
      featIndices.push(allIdx.splice(r, 1)[0])
    }

    // find best stump
    let best = null
    let bestImpurity = Infinity
    for (const f of featIndices) {
      const values = uniq(Xs.map(r => r[f])).sort((a, b) => a - b)
      if (values.length <= 1) continue
      // candidate thresholds: midpoints
      for (let i = 0; i < values.length - 1; i++) {
        const thr = (values[i] + values[i + 1]) / 2
        const leftY = []
        const rightY = []
        for (let r = 0; r < Xs.length; r++) {
          if (Xs[r][f] <= thr) leftY.push(ys[r]); else rightY.push(ys[r])
        }
        if (!leftY.length || !rightY.length) continue
        const impurity = (leftY.length / Xs.length) * gini(leftY) + (rightY.length / Xs.length) * gini(rightY)
        if (impurity < bestImpurity) {
          bestImpurity = impurity
          best = { feature: f, threshold: thr, leftY: leftY.slice(), rightY: rightY.slice() }
        }
      }
    }

    if (!best) {
      // fallback leaf predicting majority
      const counts = {}
      ys.forEach(v => counts[v] = (counts[v] || 0) + 1)
      let maxK = null
      for (const k in counts) if (maxK === null || counts[k] > counts[maxK]) maxK = k
      trees.push({ isLeaf: true, value: maxK })
      continue
    }

    // compute predictions for left/right
    const leftCounts = {}
    best.leftY.forEach(v => leftCounts[v] = (leftCounts[v] || 0) + 1)
    const leftPred = Object.keys(leftCounts).reduce((a, b) => leftCounts[a] > leftCounts[b] ? a : b)
    const rightCounts = {}
    best.rightY.forEach(v => rightCounts[v] = (rightCounts[v] || 0) + 1)
    const rightPred = Object.keys(rightCounts).reduce((a, b) => rightCounts[a] > rightCounts[b] ? a : b)

    // importance: impurity reduction
    const impReduction = baseImpurity - bestImpurity
    importances[best.feature] += impReduction

    trees.push({ isLeaf: false, feature: best.feature, threshold: best.threshold, leftPred, rightPred })
  }

  // normalize importances
  const tot = importances.reduce((s, v) => s + v, 0) || 1
  const importanceNorm = importances.map(v => v / tot)

  return { trees, importance: importanceNorm }
}

export function predictRF(model, X) {
  const trees = model.trees
  return X.map(row => {
    const votes = {}
    for (const tree of trees) {
      let pred
      if (tree.isLeaf) pred = tree.value
      else pred = row[tree.feature] <= tree.threshold ? tree.leftPred : tree.rightPred
      votes[pred] = (votes[pred] || 0) + 1
    }
    // majority vote
    return Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? a : b)
  })
}

export function accuracyScore(yTrue, yPred) {
  if (!yTrue.length) return 0
  let ok = 0
  for (let i = 0; i < yTrue.length; i++) if (String(yTrue[i]) === String(yPred[i])) ok++
  return ok / yTrue.length
}

export function confusionMatrix(labels, yTrue, yPred) {
  const uniqLabels = Array.from(new Set(labels))
  const idx = Object.fromEntries(uniqLabels.map((l, i) => [l, i]))
  const mat = Array.from({ length: uniqLabels.length }, () => Array(uniqLabels.length).fill(0))
  for (let i = 0; i < yTrue.length; i++) {
    const a = idx[yTrue[i]]
    const b = idx[yPred[i]]
    mat[a][b]++
  }
  return { labels: uniqLabels, matrix: mat }
}

"use strict";

/**!
 * @module calculate
 * @file Advanced calculations.
 * @description This module calls algorithms implemented in `algorithm` while
 * interacting with the program interface to gather data, perform calculations
 * and display results.
 */


/**
 * Initialize calculation controls.
 * @function initCalcBoxCtrl
 * @param {Object} mo - main object
 */
function initCalcBoxCtrl(mo) {

  byId('silh-calc-btn').addEventListener('click', function () {
    calcSilhouette(mo);
  });
  for (let item of ['x', 'y', 'size', 'opacity', 'color']) {
    byId(`${item}-calc-chk`).addEventListener('change', function () {
      updateCalcBoxCtrl(mo);
    });
  }

  byId('silh-done-btn').addEventListener('click', function () {
    byId('silh-modal').classList.add('hidden');
    if (byId('silh-save-chk').checked) saveSilhToCol(
      mo, byId('silh-col-text').value);
    if (byId('silh-export-chk').checked) exportSilh(mo);
  });

  byId('silh-help-btn').addEventListener('click', function () {
    window.open('https://github.com/qiyunlab/binarena#' +
      'binning-confidence-evaluation', '_blank');
  });
}


/**
 * Update calculation controls.
 * @function updateCalcBoxCtrl
 * @param {Object} mo - main object
 */
function updateCalcBoxCtrl(mo) {

  byId('silh-table-wrap').classList.add('hidden');
  byId('silh-calc-btn').classList.remove('hidden');
  byId('silh-title').classList.remove('hidden');
  byId('silh-progress').classList.add('hidden');
  byId('silh-done-div').classList.add('hidden');
  byId('silh-done-btn').classList.add('hidden');

  const view = mo.view,
        cols = mo.cols;

  // available variables
  let v, idx, chk, scale, n = 0;
  for (let item of ['x', 'y', 'size', 'opacity', 'color']) {
    v = view[item];
    idx = v.i;
    if (idx && cols.types[idx] === 'num') {
      chk = byId(`${item}-calc-chk`);
      chk.disabled = false;
      scale = v.scale;
      if (chk.checked) n++;
      byId(`${item}-calc-var`).textContent = cols.names[idx] + (
        (scale !== 'none') ? ` (${scale})` : '');
    } else {
      byId(`${item}-calc-chk`).disabled = true;
      byId(`${item}-calc-var`).textContent = '';
    }
  }
  byId('silh-calc-btn').disabled = (n === 0);
  byId('silh-col-text').value = 'silhouette';
}


/**
 * Calculate silhouette scores based on current binning plan.
 * @function calcSilhouette
 * @param {Object} mo - main object
 */
function calcSilhouette(mo) {

  byId('silh-calc-btn').classList.add('hidden');
  byId('silh-title').classList.add('hidden');
  byId('silh-progress').classList.remove('hidden');

  // const data = mo.data,
  const data = mo.data,
        view = mo.view,
        binned = mo.binned,
        masked = mo.masked;

  // collect and scale data
  const items = [], scale_data = [];
  let chk, idx, scale;
  for (let item of ['x', 'y', 'size', 'opacity', 'color']) {
    chk = byId(`${item}-calc-chk`);
    if (!chk.checked || chk.disabled) continue;
    idx = view[item].i;
    scale = view[item].scale;
    scale_data.push(scaleArr(data[idx], scale));
    items.push(item);
  }
  const num_item = items.length;

  // filter data
  console.log('Filtering data...');
  const n = mo.cache.nctg;
  let n_binned = 0,
      n_masked = 0,
      n_inval = 0;
  const filt_ctgs = [],
        filt_plan = [],
        filt_data = Array(num_item).fill().map(() => Array());
  let valid = true;
  let j;
  for (let i = 0; i < n; i++) {
    if (binned[i]) {
      n_binned++;
      if (masked[i]) {
        n_masked++;
      } else {
        valid = true;
        for (j = 0; j < num_item; j++) {
          if (!isFinite(scale_data[j][i])) {
            valid = false;
            break;
          }
        }
        if (valid) {
          filt_ctgs.push(i);
          filt_plan.push(binned[i]);
          for (let j in scale_data) {
            filt_data[j].push(scale_data[j][i]);
          }
        } else {
          n_inval++;
        }
      }
    }
  }
  const n_ctg = filt_ctgs.length;

  // convert binning plan into numbers
  const [labels, bins] = factorize(filt_plan);
  const n_bin = bins.length;

  // log sample selection
  console.log(`The data set has ${n} contigs.`);
  console.log(`In which ${n_binned} contigs are currently binned.`);
  console.log(`Excluded ${n_masked} that are currently masked.`);
  console.log(`Excluded ${n_inval} contigs that have invalid values.`);
  console.log(`A total of ${n_ctg} contigs in ${n_bin} bins are used for ` +
    'this calculation.');

  // This is a heavy calculation so a progress bar is displayed prior to
  // starting the calculation. This can only be achieved through an async
  // operation. There is no good sync way to force the browser to "flush".
  // See: https://stackoverflow.com/questions/16876394/
  setTimeout(function () {

    // min-max scaling of each variable
    console.log('Performing min-max scaling...');
    for (let j = 0; j < num_item; j++) {
      arrMinMaxScale(filt_data[j]);
    }

    // transpose data matrix
    const vals = transpose(filt_data);

    // calculate pairwise distance if not already
    // if (cache.pdist.length === 0) cache.pdist = pdist(vals);
    // note: can no longer use cache pdist
    console.log('Calculating pairwise Euclidean distances...');

    // switch to 2D version if there are too many contigs
    const use2d = n_ctg >= 20000;
    if (use2d) console.log('Switched to 2D calculation (slower but can ' +
      'handle more data points.');

    // const t0 = performance.now();
    const dm = use2d ? pdist2d(vals) : pdist(vals);
    // const t1 = performance.now();
    // console.log(t1 - t0);

    // calculate silhouette scores
    console.log('Calculating silhouette coefficients...');
    let scores = use2d ? silhouetteSample2D(vals, labels, dm) :
      silhouetteSample(vals, labels, dm);

    // cache result
    console.log('Calculation completed.');
    mo.cache.silhs = [filt_ctgs, labels, bins, scores];

    fillSilhTable(mo, byId('silh-tbody'));

    byId('silh-table-wrap').classList.remove('hidden');
    byId('silh-title').classList.remove('hidden');
    byId('silh-progress').classList.add('hidden');
    byId('silh-done-div').classList.remove('hidden');
    byId('silh-done-btn').classList.remove('hidden');

  }, 100); // this 0.1 sec delay is to wait for loading dots to start blinking
}


/**
 * Populate silhouette result table.
 * @function fillSilhTable
 * @param {Object} mo - main object
 * @param {Object} table - table DOM
 */
function fillSilhTable(mo, table) {
  const [, labels, bins, scores] = mo.cache.silhs;
  const n = scores.length;
  const bin2scores = {};
  let bin;
  for (let i = 0; i < n; i++) {
    bin = bins[labels[i]];
    if (!(bin in bin2scores)) bin2scores[bin] = [scores[i]];
    else bin2scores[bin].push(scores[i]);
  }
  const content = [];
  for (let [key, value] of Object.entries(bin2scores)) {
    if (!key) key = '(unbinned)';
    content.push([key, value.length, arrMean(value)]);
  }
  content.sort((a, b) => b[2] - a[2]);
  content.unshift(['(all)', n, arrMean(scores)]);

  table.innerHTML = '';
  let count, score, row, cell;
  for (let i = 0; i < content.length; i++) {
    [bin, count, score] = content[i];
    row = table.insertRow(-1);
    cell = row.insertCell(-1);
    cell.innerHTML = bin;
    cell = row.insertCell(-1);
    cell.innerHTML = count;
    cell = row.insertCell(-1);
    cell.innerHTML = score.toFixed(3);
    row.setAttribute('data-score', score);
  }
}


/**
 * Save silhouette result to column.
 * @function saveSilhToCol
 * @param {Object} mo - main object
 * @param {name} - column name
 */
function saveSilhToCol(mo, name) {
  if (!name) return;
  const [ctgs, , , scores] = mo.cache.silhs;
  const data = mo.data,
        cols = mo.cols;
  const names = cols.names,
        types = cols.types;
  const n = ctgs.length;
  let col = names.indexOf(name);

  // append new column and modify controls
  if (col === -1) {
    col = data.length;
    const arr = Array(mo.cache.nctg).fill(NaN);
    for (let i = 0; i < n; i++) {
      arr[ctgs[i]] = scores[i];
    }
    data.push(arr);
    names.push(name);
    types.push('num');
    updateControls(mo);
    buildInfoTable(mo);
    buildDataTable(mo);
  }

  // update existing column
  else {
    if (types[col] !== 'num') {
      toastMsg(`Error: Existing field "${name}" is not numeric.`, mo.stat);
      return;
    }
    let arr = data[col];
    arr.fill(NaN);
    for (let i = 0; i < n; i++) {
      arr[ctgs[i]] = scores[i];
    }
  }

  // color contigs by score
  mo.view.color.zero = false; // silhouettes can be negative
  const sel = byId('color-field-sel');
  sel.value = col;
  sel.dispatchEvent(new Event('change'));

  toastMsg(`Set color to field "${name}".`, mo.stat);
}


/**
 * Export silhouette result as a TSV file.
 * @function exportSilh
 * @param {Object} mo - main object
 */
function exportSilh(mo) {
  const [ctgs, labels, bins, scores] = mo.cache.silhs;
  const data = mo.data,
        cols = mo.cols;
  let tsv = '';
  tsv += (cols.names[0] + '\tbin\tsilhouette\n');
  const ids = data[0];
  const n = scores.length;
  for (let i = 0; i < n; i++) {
    tsv += ([ids[ctgs[i]], bins[labels[i]], scores[i]].join('\t') + '\n');
  }
  const a = document.createElement('a');
  a.href = "data:text/tab-separated-values;charset=utf-8," +
    encodeURIComponent(tsv);
  a.download = 'silhouette.tsv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


/**
 * Calculate adjusted Rand index between current and reference binning plans.
 * @function calcAdjRand
 * @param {Object} mo - main object
 * @param {string} field - categorical field to serve as reference
 */
function calcAdjRand(mo, field) {
  if (!mo.cache.nctg) return;
  const ari = adjustedRandScore(factorize(mo.binned)[0],
    factorize(mo.data[mo.cols.names.indexOf(field)])[0]);

  toastMsg(`Adjusted Rand index between current binning plan and ` +
    `"${field}": ${ari.toFixed(5)}.`, mo.stat, 0, false, true);
}

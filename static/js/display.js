"use strict";

/**!
 * @module display
 * @file Display functions.
 * @description This module regulates the five display items (x- and y-axis),
 * size, opacity, and color of the assembly plot.
 */


/**
 * Initialize display controls.
 * @function initDisplayCtrl
 * @params {Object} mo - main object
 */
function initDisplayCtrl(mo) {
  const view = mo.view;

  /**
   * Display panel controls
   */

  // show/hide legend
  for (let btn of document.querySelectorAll('.legend-btn')) {
    btn.addEventListener('click', function () {
      const tr = this.parentElement.parentElement.parentElement;
      const legend = tr.nextElementSibling;
      legend.classList.toggle('hidden');
      this.classList.toggle('pressed');
      // have to update legends here, because it relies on visibility
      if (!legend.classList.contains('hidden')) {
        updateLegends(mo, [tr.getAttribute('data-item')]);
      }
    });
  }

  // change display item
  for (let key of ['x', 'y', 'size', 'opacity', 'color']) {
    byId(key + '-field-sel').addEventListener('change', function () {
      byId(key + '-param-span').classList.toggle('hidden', !this.value);
      if (!this.value) {
        const div = byId(key + '-legend');
        if (div) div.parentElement.parentElement.classList.add('hidden');
      }
      displayItemChange(key, this.value, view[key].scale, mo);
    });
  }

  // swap x- and y-axes
  for (let btn of document.querySelectorAll('button.swap-btn')) {
    btn.addEventListener('click', function () {
      const xx = view.x,
            yy = view.y;
      for (let key of ['i', 'scale', 'min', 'max']) {
        xx[key] = [yy[key], yy[key] = xx[key]][0];
      }
      updateControls(mo.cols, view);
      transXForDisplay(mo);
      transYForDisplay(mo);
      renderArena(mo);
    });
  }

  // populate palettes
  populatePaletteSelect();

  // initialize continuous color map
  view.color.contmap = palette11to101(PALETTES[view.contpal]);

  // color palette select button
  byId('palette-btn').addEventListener('click', function () {
    const lst = byId('palette-select');
    if (lst.classList.contains('hidden')) {
      const val = byId('color-field-sel').value;
      if (!val) return;
      const isNum = (mo.cols.types[val] === 'num');
      for (let div of lst.querySelectorAll('.disc')) {
        div.classList.toggle('hidden', isNum);
      }
      for (let div of lst.querySelectorAll('.cont')) {
        div.classList.toggle('hidden', !isNum);
      }
      const rect = this.getBoundingClientRect();
      lst.style.top = rect.bottom + 'px';
      lst.style.left = rect.left + 'px';
      lst.classList.remove('hidden');
    } else {
      lst.classList.add('hidden');
    }
  });

  // select palette
  for (let table of byId('palette-select').querySelectorAll('table')) {
    for (let row of table.rows) {
      row.addEventListener('click', function () {
        const palette = this.firstElementChild.innerHTML;
        if (this.parentElement.parentElement.parentElement.classList
          .contains('cont')) {
          view.contpal = palette;
          view.color.contmap = palette11to101(PALETTES[palette]);
        } else {
          view.discpal = palette;
          updateColorMap(mo);
        }
        transColorForDisplay(mo);
        renderArena(mo);
        updateLegends(mo, ['color']);
      });
    }
  }

  // add/remove discrete color
  byId('add-color-btn').addEventListener('click', function () {
    view.ncolor += 1;
    updateColorMap(mo);
    transColorForDisplay(mo);
    renderArena(mo);
    updateLegends(mo, ['color']);
  });

  byId('remove-color-btn').addEventListener('click', function () {
    if (view.ncolor === 1) return;
    view.ncolor -= 1;
    updateColorMap(mo);
    transColorForDisplay(mo);
    renderArena(mo);
    updateLegends(mo, ['color']);
  });


  /**
   * Legends of display items.
   */

  for (let leg of document.querySelectorAll('.legend')) {

    leg.addEventListener('mouseenter', function () {
      for (let clip of this.querySelectorAll('.clip')) {
        clip.classList.add('hidden');
      }
    });

    leg.addEventListener('mouseleave', function () {
      this.setAttribute('data-ranging', 'none');
      for (let clip of this.querySelectorAll('.clip')) {
        clip.classList.remove('hidden');
      }
    });
  }

  for (let grad of document.querySelectorAll('.gradient')) {

    grad.addEventListener('mousemove', function (e) {
      const item = this.parentElement.getAttribute('data-item');
      const v = view[item];
      const rect = this.getBoundingClientRect();
      const width = rect.right - rect.left;
      const offset = e.clientX - rect.left;
      const step = width / 10;
      const ranging = this.parentElement.getAttribute('data-ranging');

      // show tooltip
      if (ranging === 'none') {

        // skip if cursor is outside range
        if (offset < this.parentElement.querySelector('.range.lower')
          .getAttribute('data-tick') * step) return;
        if (offset > this.parentElement.querySelector('.range.upper')
          .getAttribute('data-tick') * step) return;

        // specify tip position
        const tip = byId('legend-tip');
        tip.style.left = e.clientX + 'px';
        tip.style.top = Math.round(rect.bottom) + 'px';

        // specify tip label
        const vmin = v.zero ? 0 : v.min;
        const value = scaleNum(vmin + offset / width * (v.max - vmin),
          unscale(v.scale));
        byId('legend-value').innerHTML = formatValueLabel(
          value, view[item].i, 3, true, mo);

        // item-specific operations
        const circle = byId('legend-circle');
        circle.classList.remove('hidden');
        if (item === 'size') {
          circle.style.backgroundColor = 'black';
          const diameter = Math.ceil(view.rbase * 2 * offset / width);
          circle.style.height = diameter + 'px';
          circle.style.width = diameter + 'px';
        }
        else if (item === 'opacity') {
          circle.style.height = '15px';
          circle.style.width = '15px';
          circle.style.backgroundColor = 'rgba(0,0,0,' + (offset / width)
            .toFixed(2) + ')';
        }
        else if (item === 'color') {
          circle.style.height = '15px';
          circle.style.width = '15px';
          circle.style.backgroundColor = 'rgb(' + view.color.contmap[
            Math.round(offset / width * 100)] + ')';
        }
      }

      // drag to adjust range
      else {
        const tick = Math.round(offset / width * 10);
        const range = this.parentElement.querySelector('.range.' + ranging);
        if (tick == range.getAttribute('data-tick')) return;
        // ensure there's at least one step between lower & upper bounds
        const other = (ranging === 'lower') ? 'upper' : 'lower';
        const space = (this.parentElement.querySelector('.range.' + other)
          .getAttribute('data-tick') - tick) * (1 - ['lower', 'upper']
          .indexOf(ranging) * 2);
        if (space < 1) return;
        range.setAttribute('data-tick', tick);
        range.style.left = Math.round(rect.left + tick * step) + 'px';
      }
    });

    grad.addEventListener('mouseenter', function () {
      if (this.parentElement.getAttribute('data-ranging') === 'none') {
        byId('legend-tip').classList.remove('hidden');
      }
    });

    grad.addEventListener('mouseleave', function () {
      byId('legend-tip').classList.add('hidden');
    });

    grad.addEventListener('mouseup', function () {
      const ranging = this.parentElement.getAttribute('data-ranging');
      if (ranging === 'none') {
        byId('legend-tip').classList.add('hidden');
      } else {
        this.parentElement.setAttribute('data-ranging', 'none');
        const item = this.parentElement.getAttribute('data-item');
        view[item][ranging]= parseInt(this.parentElement.querySelector(
          '.range.' + ranging).getAttribute('data-tick')) * 10;
        transDataForDisplay(mo, [item]);
        renderArena(mo);
        updateLegends(mo, [item]);
      }
    });
  }

  for (let range of document.querySelectorAll('.legend .range')) {
    range.title = 'Adjust ' + checkClassName(range, ['lower', 'upper']) +
      ' bound of ' + range.parentElement.getAttribute('data-item');
    range.addEventListener('mousedown', rangeMouseDown);
    range.addEventListener('mouseup', rangeMouseUp);
  }

  function rangeMouseDown(e) {
    e.preventDefault();
    this.parentElement.setAttribute('data-ranging',
      checkClassName(this, ['lower', 'upper']));
  }

  function rangeMouseUp(e) {
    e.preventDefault();
    this.parentElement.setAttribute('data-ranging', 'none');
    const item = this.parentElement.getAttribute('data-item');
    view[item][checkClassName(this, ['lower', 'upper'])] =
      this.getAttribute('data-tick') * 10;
    transDataForDisplay(mo, [item]);
    renderArena(mo);
    updateLegends(mo, [item]);
  }

  for (let label of document.querySelectorAll('.legend .min')) {
    label.title = 'Toggle zero or minimum value';
    label.addEventListener('click', function () {
      const item = this.parentElement.getAttribute('data-item');
      view[item].zero = !view[item].zero;
      transDataForDisplay(mo, [item]);
      renderArena(mo);
      updateLegends(mo, [item]);
    });
  }

}


/**
 * Update display panel controls by data.
 * @function updateDisplayCtrl
 * @param {Object} cols - cols object
 * @param {Object} view - view object
 */
function updateDisplayCtrl(cols, view) {
  const names = cols.names,
        types = cols.types;

  // display items to be updated
  const keys = ['x', 'y', 'size', 'opacity', 'color'];

  const n = names.length;
  let sel, i, type, opt, idx, span, scale, btn;
  for (let key of keys) {
    sel = byId(key + '-field-sel');
    sel.innerHTML = '';

    // all but coordinates can be empty
    if (key !== 'x' && key !== 'y') {
      sel.add(document.createElement('option'));
    }

    // add fields to each list
    for (i = 0; i < n; i++) {
      type = types[i];
      if (type === 'num' || (type === 'cat' && key === 'color')) {

        // create an option
        opt = document.createElement('option');
        opt.value = i;
        opt.text = names[i];
        sel.add(opt);

        // pre-defined index
        idx = view[key].i;
        if (idx) sel.value = idx;
        span = byId(key + '-param-span');
        if (idx) span.classList.remove('hidden');
        else span.classList.add('hidden');

        // pre-defined scale
        scale = view[key].scale;
        btn = byId(key + '-scale-btn');
        btn.setAttribute('data-scale', scale);
        btn.title = 'Scale: ' + scale;
        btn.innerHTML = scale2HTML(scale);
      }
    }
  }
}


/**
 * Update legends.
 * @function updateLegends
 * @param {Object} mo - main object
 * @param {Array.<string>} [items] - display items to update
 * @todo other items
 */
function updateLegends(mo, items) {
  items = items || ['size', 'opacity', 'color'];
  let icol, isCat, scale, legend, grad, rect, step, poses, clip;

  for (let item of items) {
    icol = mo.view[item].i;
    if (!icol) continue;

    // discrete colors
    if (item === 'color') {
      isCat = (mo.cols.types[icol] === 'cat');
      byId('color-legend').classList.toggle('hidden', isCat);
      byId('color-legend-2').classList.toggle('hidden', !isCat);
      if (isCat) {
        updateColorTable(mo);
        continue;
      }
    }

    // continuous data
    scale = unscale(mo.view[item].scale);
    legend = byId(item + '-legend');
    grad = legend.querySelector('.gradient');
    if (grad === null) continue;

    // refresh labels
    for (let key of ['min', 'max']) {
      const label = legend.querySelector('label.' + key);
      let value = scaleNum(mo.view[item][key], scale);
      value = formatValueLabel(value, icol, 3, false, mo);
      label.setAttribute('data-value', value);
      label.innerHTML = (key === 'min' && mo.view[item].zero) ? 0 : value;
    }

    // item-specific operations
    if (item === 'size') updateSizeGradient(mo);
    if (item === 'color') updateColorGradient(mo);

    // position ranges
    rect = grad.getBoundingClientRect();
    step = (rect.right - rect.left) / 10;
    poses = {};
    for (let key of ['lower', 'upper']) {
      poses[key] = legend.querySelector('.range.' + key).getAttribute(
        'data-tick') * step;
      legend.querySelector('.range.' + key).style.left = Math.round(
        rect.left + poses[key]) + 'px';
    }

    // position clips
    clip = legend.querySelector('.clip.lower');
    clip.style.left = Math.round(rect.left) + 'px';
    clip.style.width = Math.floor(poses.lower) + 'px';
    clip = legend.querySelector('.clip.upper');
    clip.style.left = Math.round(rect.left + poses.upper) + 'px';
    clip.style.width = Math.ceil(rect.right - rect.left - poses.upper) + 'px';
  }
}


/**
 * Update gradient in size legend.
 * @function updateSizeGradient
 * @param {Object} mo - main object
 * @description The ladder-shaped gradient is achieved by css borders, which,
 * cannot accept percentage, thus need to be adjusted specifically.
 */
function updateSizeGradient(mo) {
  const rbase = mo.view.rbase;
  const grad = byId('size-gradient');
  grad.style.height = rbase + 'px';
  grad.style.borderTopWidth = rbase + 'px';
  const rect = grad.getBoundingClientRect();
  grad.style.borderRightWidth = Math.floor(rect.right - rect.left) + 'px';
}


/**
 * Update gradient in continuous color legend.
 * @function updateColorGradient
 * @param {Object} mo - main object
 */
function updateColorGradient(mo) {
  const ci = mo.view.color.i;
  if (!ci) return;
  if (mo.cols.types[ci] === 'cat') return;
  byId('color-gradient').style.backgroundImage =
    'linear-gradient(to right, ' + PALETTES[mo.view.contpal].map(
    function (e) { return '#' + e; }).join(', ') + ')';
}


/**
 * Update table in discrete color legend.
 * @function updateColorTable
 * @param {Object} mo - main object
 */
function updateColorTable(mo) {
  const table = byId('color-table');
  table.innerHTML = '';
  const cmap = mo.view.color.discmap;
  let row, cell, div;

  // row for each category
  for (let cat in cmap) {
    row = table.insertRow(-1);
    cell = row.insertCell(-1);
    div = document.createElement('div');
    div.innerHTML = '&nbsp;';
    div.style.backgroundColor = '#' + cmap[cat];
    cell.appendChild(div);
    cell = row.insertCell(-1);
    cell.innerHTML = cat;
  }

  // row for others & n/a
  row = table.insertRow(-1);
  cell = row.insertCell(-1);
  div = document.createElement('div');
  div.innerHTML = '&nbsp;';
  div.style.backgroundColor = 'black';
  cell.appendChild(div);
  cell = row.insertCell(-1);
  cell.innerHTML = 'Others & N/A';
}


/**
 * Populate palette select box.
 * @function populatePaletteSelect
 */
function populatePaletteSelect() {
  const popup = byId('palette-select');
  for (let div of popup.querySelectorAll('div')) {
    const table = document.createElement('table');
    const pals = div.classList.contains('sequ') ? SEQUENTIAL_PALETTES
      : (div.classList.contains('dive') ? DIVERGING_PALETTES
      : QUALITATIVE_PALETTES);

    // create palette list
    for (let pal of pals) {
      const row = table.insertRow(-1);
      let cell = row.insertCell(-1);
      cell.innerHTML = pal;
      cell = row.insertCell(-1);
      const box = document.createElement('div');

      // continuous color
      if (div.classList.contains('cont')) {
        box.innerHTML = '&nbsp;';
        box.style.backgroundImage = 'linear-gradient(to right, ' +
          PALETTES[pal].map(e => '#' + e).join(', ') + ')';
      }

      // discrete color
      else {
        let span;
        for (let i = 0; i < 8; i++) {
          span = document.createElement('span');
          span.innerHTML = '&nbsp;';
          span.style.backgroundColor = '#' + PALETTES[pal][i];
          box.appendChild(span);
        }
      }
      cell.appendChild(box);
    }

    div.appendChild(table);
  }
}


/**
 * Initiate display items based on the dataset.
 * @function initDisplayItems
 * @param {Object} mo - main object
 * @description Basically, it is a "guess" process.
 */
function initDisplayItems(mo) {
  const view = mo.view;
  const items = ['x', 'y', 'size', 'opacity', 'color'];
  const fields = guessDisplayFields(mo);
  for (let item of items) view[item].i = fields[item];
  const scales = guessDisplayScales(mo);
  for (let item of items) view[item].scale = scales[item];
}


/**
 * Update color map based on selected field and palette.
 * @function updateColorMap
 * @param {Object} mo - main object
 * @todo add feature (treat as number)
 */
function updateColorMap(mo) {
  const icol = mo.view.color.i;
  if (!icol) return;
  if (mo.cols.types[icol] !== 'cat') return;

  // get categories and their frequencies
  let cats = {};
  const C = mo.data[icol];
  const n = C.length;
  let val;
  for (let i = 0; i < n; i++) {
    val = C[i];
    if (!val) continue;
    cats[val] = (cats[val] || 0) + 1;
  }

  // convert object to array of key: value pairs
  cats = Object.keys(cats).map(key => [key, cats[key]]);

  // sort by frequency from high to low
  cats.sort((a, b) => b[1] - a[1]);

  // number of colors to show
  const ncolor = Math.min(mo.view.ncolor, cats.length);

  // obtain colors from palette (allow repeats if palette is shorter)
  const palette = PALETTES[mo.view.discpal];
  const m = palette.length;
  const res = {};
  for (let i = 0; i < ncolor; i++) {
    res[cats[i][0]] = palette[i % m];
  }
  mo.view.color.discmap = res;
}


/**
 * Update view given current view parameters.
 * @function updateView
 * @param {Object} mo - main object
 */
function updateView(mo) {
  renderArena(mo);
  renderSelection(mo);
  if (mo.stat.drawing) drawPolygon(mo);
  mo.rena.focus();
}


/**
 * Update view based on data.
 * @function updateViewByData
 * @param {Object} mo - main object
 * @description Singling out cache is for performance consideration.
 * @todo to fix
 */
function updateViewByData(mo) {
  resetControls();

  // clear work
  mo.picked.length = 0;
  mo.masked.length = 0;
  mo.tabled.length = 0;
  mo.bins = {};

  // clear cache
  const cache = mo.cache;
  cache.abund = 0;
  cache.speci = {};
  cache.freqs = {};
  cache.npick = 0;
  cache.nmask = 0;
  cache.locis = {};
  cache.pdist = [];

  // data is closed
  const data = mo.data,
        cols = mo.cols;
  if (data.length === 0) {
    cache.nctg = 0;
    byId('hide-side-btn').click();
    byId('show-side-btn').disabled = true;
    byId('drop-sign').classList.remove('hidden');
    const btn = byId('dash-btn');
    if (btn.classList.contains('active')) btn.click();
    byId('dash-panel').classList.add('hidden');
  }

  // data is open
  else {
    cache.nctg = data[0].length;
    byId('show-side-btn').disabled = false;
    byId('show-side-btn').click();
    byId('drop-sign').classList.add('hidden');
    const btn = byId('dash-btn');
    if (!btn.classList.contains('active')) btn.click();

    // show all data in table
    mo.tabled = [...data[0].keys()];

    // guess special columns
    cache.speci = {
      len: guessLenColumn(cols),
      cov: guessCovColumn(cols),
      gc:  guessGCColumn(cols)
    };

    // calculate category and feature frequencies
    const types = cols.types;
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      if (type === 'cat') {
        cache.freqs[i] = listCats(data[i]);
      } else if (type === 'fea') {
        cache.freqs[i] = listFeas(data[i]);
      }
    }

    // calculate total abundance
    if (cache.speci.len && cache.speci.cov) {
      const L = data[cache.speci.len],
            C = data[cache.speci.cov];
      const n = L.length;
      for (let i = 0; i < n; i++) {
        cache.abund += L[i] * C[i];
      }
    }
  }

  // reset transformed data
  const trans = mo.trans;
  for (let item of ['x', 'y', 'size', 'opacity', 'color']) {
    trans[item] = Array(cache.nctg);
  }

  // manipulate interface
  const view = mo.view;
  initDisplayItems(mo);
  updateColorMap(mo);
  updateControls(cols, view);
  buildInfoTable(mo);
  buildDataTable(mo);
  byId('bin-tbody').innerHTML = '';

  // reset view
  resetView(mo);
}


/**
 * Initiate or restore default view given data.
 * @function resetView
 * @param {Object} mo - main object
 */
function resetView(mo) {

  // center view
  const view = mo.view;
  view.scale = 1.0;
  const rena = mo.rena;
  view.posX = rena.width / 2;
  view.posY = rena.height / 2;

  // calculate display item ranges
  calcDispMinMax(mo);

  // transforme data for display
  transDataForDisplay(mo);

  // render plots
  updateView(mo);
}


/**
 * Calculate min and max of display items
 * @function calcDispMinMax
 * @param {Object} mo - main object
 * @param {Array.<string>} [items] - display items to calculate
 */
function calcDispMinMax(mo, items) {
  items = items || ['x', 'y', 'size', 'opacity', 'color'];
  const data = mo.data,
        view = mo.view,
        mask = mo.masked;
  const n = mo.cache.nctg;
  if (n === 0) return;

  // calculate min / max for each item
  let v, idx, col, arr, i, val, scale, min, max;
  for (let item of items) {
    v = view[item];
    idx = v.i;
    if (!idx) continue;
    col = data[idx];
    arr = [];
    for (i = 0; i < n; i++) {
      val = col[i];
      if (val === val && !mask[i]) arr.push(val);
    }

    // calculate min and max of display items
    scale = v.scale;
    [min, max] = arrMinMax(arr);
    v.min = scaleNum(min, scale);
    v.max = scaleNum(max, scale);
  }

  // update controls
  updateLegends(mo);

}


/**
 * Transform data for visualization purpose.
 * @function transDataForDisplay
 * @param {Object} mo - main object
 * @param {string[]} [items] - item(s) to transform
 */
function transDataForDisplay(mo, items) {
  items = items || ['x', 'y', 'size', 'opacity', 'color'];
  if (!mo.cache.nctg) return;
  for (let item of items) {
    switch (item) {
      case 'x':
        transXForDisplay(mo);
        break;
      case 'y':
        transYForDisplay(mo);
        break;
      case 'size':
        transSizeForDisplay(mo);
        break;
      case 'opacity':
        transOpacityForDisplay(mo);
        break;
      case 'color':
        transColorForDisplay(mo);
        break;
    }
  }
}


/**
 * Transform x-axis data for visualization.
 * @function transXForDisplay
 * @param {Object} mo - main object
 */
function transXForDisplay(mo) {
  const v = mo.view.x;
  const target = mo.trans.x;
  const source = mo.data[v.i],
        scale = v.scale,
        min = v.min,
        range = v.max - min;
  const n = mo.cache.nctg;
  for (let i = 0; i < n; i++) {
    target[i] = (scaleNum(source[i], scale) - min) / range - 0.5;
  }
}


/**
 * Transform y-axis data for visualization.
 * @function transYForDisplay
 * @param {Object} mo - main object
 * @description Note that the formulae for x-axis and y-axis are different.
 * That's because the y-axis in an HTML5 canvas starts from top rather than
 * bottom.
 */
function transYForDisplay(mo) {
  const v = mo.view.y;
  const target = mo.trans.y;
  const source = mo.data[v.i],
        scale = v.scale,
        max = v.max,
        range = max - v.min;
  const n = mo.cache.nctg;
  for (let i = 0; i < n; i++) {
    target[i] = (max - scaleNum(source[i], scale)) / range - 0.5;
  }
}


/**
 * Transform size data for visualization.
 * @function transSizeForDisplay
 * @param {Object} mo - main object
 * @description This function calculates the radius of each data point.
 */
function transSizeForDisplay(mo) {
  const v = mo.view.size;
  const target = mo.trans.size;
  const base = mo.view.rbase;
  if (!v.i) {
    target.fill(base);
    return;
  }
  const source = mo.data[v.i],
        scale = v.scale,
        min = v.zero ? 0 : v.min,
        low = v.lower / 100,
        fac = (v.upper / 100 - low) / (v.max - min);
  const n = mo.cache.nctg;
  for (let i = 0; i < n; i++) {
    target[i] = ((scaleNum(source[i], scale) - min) * fac + low) * base;
  }
}


/**
 * Transform opacity data for visualization.
 * @function transOpacityForDisplay
 * @param {Object} mo - main object
 * @description This function calculates the alpha value of each data point.
 */
function transOpacityForDisplay(mo) {
  const v = mo.view.opacity;
  const target = mo.trans.opacity;
  const base = mo.view.obase;
  if (!v.i) {
    target.fill(base);
    return;
  }
  const source = mo.data[v.i],
        scale = v.scale,
        min = v.zero ? 0 : v.min,
        low = v.lower / 100,
        fac = (v.upper / 100 - low) / (v.max - min);
  const n = mo.cache.nctg;
  for (let i = 0; i < n; i++) {
    target[i] = ((scaleNum(source[i], scale) - min) * fac + low).toFixed(2);
  }
}


/**
 * Transform color data for visualization.
 * @function transColorForDisplay
 * @param {Object} mo - main object
 * @description This function calculates the RGB values of each data point.
 */
function transColorForDisplay(mo) {
  const v = mo.view.color;
  const target = mo.trans.color;
  target.fill('0,0,0');
  const vi = v.i;
  if (!vi) return;
  const source = mo.data[vi];
  const n = mo.cache.nctg;

  // discrete color map for numeric data
  if (mo.cols.types[vi] === 'cat') {
    const cmap = v.discmap;
    let val;
    for (let i = 0; i < n; i++) {
      val = source[i];
      if (val in cmap) target[i] = hexToRgb(cmap[val]);
    }
  }

  // continuous color map for categorical data
  else {
    const cmap = v.contmap;
    const scale = v.scale,
          min = v.zero ? 0 : v.min,
          low = v.lower,
          fac = (v.upper - low) / (v.max - min);
    for (let i = 0; i < n; i++) {
      target[i] = cmap[Math.round((scaleNum(source[i], scale) - min) *
        fac + low)];
    }
  }
}


/**
 * When user changes display item.
 * @function displayItemChange
 * @param {Object} item - display item
 * @param {Object} i - new field index
 * @param {Object} scale - new scaling factor
 * @param {Object} mo - main object
 * @todo throw if max === min
 */
function displayItemChange(item, i, scale, mo) {
  mo.view[item].i = i;
  mo.view[item].scale = scale;

  // if x- or y-coordinates change, reset view
  if (item === 'x' || item === 'y') {
    resetView(mo);
    return;
  }

  // otherwise, keep current viewport
  const isCat = (item === 'color' && mo.cols.types[i] === 'cat');
  if (isCat) updateColorMap(mo);
  else calcDispMinMax(mo, [item]);
  transDataForDisplay(mo, [item]);
  renderArena(mo);
  updateLegends(mo, [item]);
}


/**
 * Close current dataset.
 * @function closeData
 * @param {Object} mo - main object
 */
function closeData(mo) {
  mo.data.length = 0; // clear an array in place
  mo.cols.names.length = 0;
  mo.cols.types.length = 0;
}

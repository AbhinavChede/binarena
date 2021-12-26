"use strict";

/**!
 * @module render
 * @file Main assembly plot rendering functions.
 * @description The main plot is a scatter plot of contigs in an assembly.
 */


/**
 * Initialize canvas.
 * @function initCanvas
 * @params {Object} mo - main object
 */
function initCanvas(mo) {

  // the two main canvases that render the assembly plot
  mo.rena = byId('arena-canvas');
  mo.oray = byId('overlay-canvas');

  const view = mo.view,
        stat = mo.stat,
        rena = mo.rena;

  resizeArena(mo);

  /** mouse events */
  rena.addEventListener('mousedown', function (e) {
    stat.mousedown = true;
    stat.dragX = e.clientX - view.posX;
    stat.dragY = e.clientY - view.posY;
  });

  rena.addEventListener('mouseup', function () {
    stat.mousedown = false;
  });

  rena.addEventListener('mouseover', function () {
    stat.mousedown = false;
  });

  rena.addEventListener('mouseout', function () {
    stat.mousedown = false;
    stat.mousemove = false;
  });

  rena.addEventListener('mousemove', function (e) {
    canvasMouseMove(e, mo);
  });

  rena.addEventListener('mousewheel', function (e) {
    view.scale *= e.wheelDelta > 0 ? (4 / 3) : 0.75;
    updateView(mo);
  });

  rena.addEventListener('DOMMouseScroll', function (e) {
    view.scale *= e.detail > 0 ? 0.75 : (4 / 3);
    updateView(mo);
  });

  rena.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    const menu = byId('context-menu');
    menu.style.top = e.clientY + 'px';
    menu.style.left = e.clientX + 'px';
    menu.classList.remove('hidden');
  });

  rena.addEventListener('click', function (e) {
    canvasMouseClick(e, mo);
  });

  /** drag & drop file to upload */
  rena.addEventListener('dragover', function (e) {
    e.preventDefault();
  });

  rena.addEventListener('dragenter', function (e) {
    e.preventDefault();
  });

  rena.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    uploadFile(e.dataTransfer.files[0], mo);
  });

  /** keyboard events */
  rena.addEventListener('keydown', function (e) {
    // const t0 = performance.now();
    switch (e.key) {
      case 'Left':
      case 'ArrowLeft':
        byId('left-btn').click();
        break;
      case 'Up':
      case 'ArrowUp':
        byId('up-btn').click();
        break;
      case 'Right':
      case 'ArrowRight':
        byId('right-btn').click();
        break;
      case 'Down':
      case 'ArrowDown':
        byId('down-btn').click();
        break;
      case '-':
      case '_':
        byId('zoomout-btn').click();
        break;
      case '=':
      case '+':
        byId('zoomin-btn').click();
        break;
      case '0':
        byId('reset-btn').click();
        break;
      case 'p':
      case 'P':
        byId('screenshot-btn').click();
        break;
      case 'Delete':
      case 'Backspace':
        byId('mask-btn').click();
        break;
      case 'Enter':
        polygonSelect(mo, e.shiftKey);
        break;
      case ' ':
        byId('as-new-bin-btn').click();
        break;
      case '.':
      case '>':
        byId('add-to-bin-btn').click();
        break;
      case ',':
      case '<':
        byId('remove-from-bin-btn').click();
        break;
      case '/':
      case '?':
        byId('update-bin-btn').click();
        e.preventDefault(); // otherwise it will open Firefox quick find bar
        break;
    }
    // const t1 = performance.now();
    // console.log(t1 - t0);
  });
} // end initializing controls


/**
 * Canvas mouse move event.
 * @function canvasMouseMove
 * @param {Object} e - event object
 * @param {Object} mo - main object
 */
 function canvasMouseMove(e, mo) {
  const view = mo.view,
        stat = mo.stat,
        rena = mo.rena;

  // drag to move the canvas
  if (stat.mousedown) {
    const posX = e.clientX - stat.dragX,
          posY = e.clientY - stat.dragY;

    // won't move if offset is within a pixel
    // this is to prevent accidential tiny moves while clicking
    if (Math.abs(posX - view.posX) > 1 || Math.abs(posY - view.posY) > 1) {
      stat.mousemove = true;
      view.posX = posX;
      view.posY = posY;
      updateView(mo);
    }
  }

  // show current coordinates
  else if (mo.view.grid) {
    const x = ((e.offsetX - view.posX) / view.scale / rena.width + 0.5) *
      (view.x.max - view.x.min) + view.x.min;
    const y = view.y.max - ((e.offsetY - view.posY) / view.scale /
      rena.height + 0.5) * (view.y.max - view.y.min);
    byId('coords-label').innerHTML = x.toFixed(3) + ',' + y.toFixed(3);
  }
}


/**
 * Canvas mouse click event.
 * @function canvasMouseClick
 * @param {Object} e - event object
 * @param {Object} mo - main object
 */
function canvasMouseClick(e, mo) {
  const data = mo.data,
        view = mo.view,
        stat = mo.stat,
        rena = mo.rena;

  // mouse up after dragging
  if (stat.mousemove) {
    stat.mousemove = false;
  }

  // keep drawing polygon
  else if (stat.drawing) {
    stat.polygon.push({
      x: (e.offsetX - view.posX) / view.scale,
      y: (e.offsetY - view.posY) / view.scale,
    });
    drawPolygon(mo);
  }

  // determine which contigs are clicked
  else {
    const n = mo.cache.nctg;
    if (!n) return;
    const pick = mo.pick,
          mask = mo.mask;

    // clear current selection
    if (!e.shiftKey) {
      pick.fill(false);
      mo.cache.npick = 0;
    }

    // get mouse position    
    const x0 = (e.offsetX - view.posX) / view.scale,
          y0 = (e.offsetY - view.posY) / view.scale;

    const si = view.size.i;
    const S = si ? data[si] : null;
    const X = data[view.x.i],
          Y = data[view.y.i];

    const arr = [];
    let radius, x, y, x2y2;
    for (let i = 0; i < n; i++) {
      if (mask[i]) continue;
      radius = si ? scaleNum(S[i], view.size.scale) * view.rbase /
        view.size.max : view.rbase;
      x = ((scaleNum(X[i], view.x.scale) - view.x.min) /
        (view.x.max - view.x.min) - 0.5) * rena.width;
      y = ((view.y.max - scaleNum(Y[i], view.y.scale)) /
        (view.y.max - view.y.min) - 0.5) * rena.height;

      // calculate distance to center
      x2y2 = (x - x0) ** 2 + (y - y0) ** 2;

      // if mouse is within contig area, consider as a click
      if (x2y2 <= radius ** 2) arr.push([i, x2y2]);
    }

    // if one or more contigs are clicked
    if (arr.length > 0) {

      // sort clicked contigs by proximity from center to mouse position
      // no need to square root because it is monotonic
      arr.sort((a, b) => a[1] - b[1]);
      let ctg = arr[0][0];

      // if already selected, unselect; else, select
      if (pick[ctg]) {
        pick[ctg] = false;
        mo.cache.npick -= 1;
      } else {
        pick[ctg] = true;
        mo.cache.npick += 1;
      }
    }
    updateSelection(mo);
  }
}


/**
 * Calculate arena dimensions based on style and container.
 * @function calcArenaDimensions
 * @param {Object} rena - arena canvas DOM
 * @returns {[number, number]} - width and height of arena
 */
function calcArenaDimensions(rena) {
  const w = Math.max(parseInt(getComputedStyle(rena).minWidth),
    rena.parentElement.parentElement.offsetWidth);
  const h = Math.max(parseInt(getComputedStyle(rena).minHeight),
    rena.parentElement.parentElement.offsetHeight);
  return [w, h];
}


/**
 * Update canvas dimensions.
 * @function resizeArena
 * @param {Object} mo - main object
 * @description For an HTML5 canvas, (plot) and style width are two things.
 * @see {@link https://stackoverflow.com/questions/4938346/}
 */
function resizeArena(mo) {
  const rena = mo.rena,
        oray = mo.oray;
  const [w, h] = calcArenaDimensions(rena);

  // update width
  if (rena.style.width !== w) rena.style.width = w;
  if (rena.width !== w) rena.width = w;
  if (oray.style.width !== w) oray.style.width = w;
  if (oray.width !== w) oray.width = w;

  // update height
  if (rena.style.height !== h) rena.style.height = h;
  if (rena.height !== h) rena.height = h;
  if (oray.style.height !== h) oray.style.height = h;
  if (oray.height !== h) oray.height = h;

  // re-draw plots
  updateView(mo);
}


/**
 * Render arena given current data and view.
 * @function renderArena
 * @param {Object} mo - main object
 * @description This is the main rendering engine of the program. It is also a
 * computationally expensive task. Several resorts have been adopted to improve
 * performance, including:
 * - Minimize fill style changes.
 * - Minimize number of paths.
 * - Round numbers to integers.
 * - For small circles draw squares instead.
 * - Cache variables and references.
 * @todo {@link https://stackoverflow.com/questions/21089959/}
 * @todo rectangle-circle collision detection
 * @todo round floats into integers should improve performance, but may cause
 * problem when zoomin scale is large, needs further thought
 * @todo get rid of masked contigs prior to loop
 */
function renderArena(mo) {
  const data = mo.data,
        view = mo.view,
        rena = mo.rena,
        mask = mo.mask;
  const types = mo.cols.types;

  // prepare canvas context
  // note: origin (0, 0) is at the upper-left corner
  const ctx = rena.getContext('2d');

  // clear canvas
  ctx.clearRect(0, 0, rena.width, rena.height);
  ctx.save();

  // move to current position
  ctx.translate(view.posX, view.posY);

  // scale canvas
  const scale = view.scale;
  ctx.scale(scale, scale);

  // nothing to draw
  if (data.length === 0) {
    ctx.restore();
    return;
  }

  // alternative: css scale, which is theoretically faster, but it blurs when
  // zoom in
  // rena.style.transformOrigin = '0 0';
  // rena.style.transform = 'scale(' + view.scale + ')';

  // cache constants
  const pi2 = Math.PI * 2,
        pi1_2 = Math.sqrt(Math.PI),
        min1 = Math.sqrt(1 / Math.PI),
        min2 = Math.sqrt(4 / Math.PI);

  // cache parameters
  const w = rena.width,
        h = rena.height;
  // x-axis
  const X = data[view.x.i],
        xscale = view.x.scale,
        xmin = view.x.min,
        xmax = view.x.max,
        dx = xmax - xmin;
  // y-axis
  const Y = data[view.y.i],
        yscale = view.y.scale,
        ymin = view.y.min,
        ymax = view.y.max,
        dy = ymax - ymin;
  // size
  const rbase = view.rbase;
  const si = view.size.i,
        S = si ? data[si] : null,
        sscale = view.size.scale,
        smin = view.size.zero ? 0 : view.size.min,
        slow = view.size.lower / 100,
        sfac = (view.size.upper / 100 - slow) / (view.size.max - smin);
  // opacity
  const obase = view.obase;
  const oi = view.opacity.i,
        O = oi ? data[oi] : null,
        oscale = view.opacity.scale,
        omin = view.opacity.zero ? 0 : view.opacity.min,
        olow = view.opacity.lower / 100,
        ofac = (view.opacity.upper / 100 - olow) / (view.opacity.max - omin);
  // color
  const ci = view.color.i,
        C = ci ? data[ci] : null,
        discmap = view.color.discmap,
        contmap = view.color.contmap,
        ctype = ci ? types[ci] : null,
        cscale = view.color.scale,
        cmin = view.color.zero ? 0 : view.color.min,
        clow = view.color.lower,
        cfac = (view.color.upper - clow) / (view.color.max - cmin);

  // cannot render if there is no x- or y-axis
  if (X === undefined || Y === undefined) {
    ctx.restore();
    return;
  }

  // calculate edges of visible region
  const vleft = -view.posX / scale,
        vright = (w - view.posX) / scale,
        vtop = -view.posY / scale,
        vbottom = (h - view.posY) / scale;

  // elements to be rendered, grouped by fill style, then by circle or square
  const paths = {};

  // intermediates
  let radius, rviz, x, y, c, val, alpha, fs;

  // determine appearance of contig
  let n = X.length;
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue;

    // determine radius (size)
    radius = si ? ((scaleNum(S[i], sscale) - smin) * sfac + slow) *
      rbase : rbase;
    rviz = radius * scale;

    // if contig occupies less than one pixel on screen, skip
    if (rviz < min1) continue;

    // determine x- and y-coordinates
    x = Math.round(((scaleNum(X[i], xscale) - xmin) / dx - 0.5) * w);
    y = Math.round(((ymax - scaleNum(Y[i], yscale)) / dy - 0.5) * h);

    // skip contigs outside visible region
    if (x + radius < vleft || x - radius > vright) continue;
    if (y + radius < vtop || y - radius > vbottom) continue;

    // determine color
    c = '0,0,0';
    if (ci) {
      val = C[i];
      if (val) {
        // discrete data
        if (ctype === 'cat') {
          if (val in discmap) c = hexToRgb(discmap[val]);
        }

        // continuous data
        else {
          c = contmap[Math.round((scaleNum(val, cscale) - cmin) *
            cfac + clow)];
        }
      }
    }

    // determine opacity
    alpha = oi ? ((scaleNum(O[i], oscale) - omin) * ofac + olow)
      .toFixed(2) : obase;

    // generate fill style string
    fs = `rgba(${c},${alpha})`;
    if (!(fs in paths)) paths[fs] = { 'square': [], 'circle': [] };

    // if a contig occupies less than four pixels on screen, draw a square
    if (rviz < min2) {
      paths[fs].square.push([x, y, Math.round(radius * pi1_2)]);
    }

    // if bigger, draw a circle
    else {
      paths[fs].circle.push([x, y, Math.round(radius)]);
    }
  } // end for i

  // render contigs
  let squares, sq, circles, circ;
  for (let fs in paths) {
    ctx.fillStyle = fs;

    // draw squares
    squares = paths[fs].square;
    n = squares.length;
    for (let i = 0; i < n; i++) {
      sq = squares[i];
      ctx.fillRect(sq[0], sq[1], sq[2], sq[2]);
    }

    // draw circles
    circles = paths[fs].circle;
    n = circles.length;
    if (n === 0) continue;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      circ = circles[i];
      ctx.moveTo(circ[0], circ[1]);
      ctx.arc(circ[0], circ[1], circ[2], 0, pi2, true);
    }
    ctx.fill();
  } // end for fs


  // draw grid
  if (view.grid) drawGrid(rena, view);

  ctx.restore();
}


/**
 * Render shadows around selected contigs.
 * @function renderSelection
 * @param {Object} mo - main object
 * @see renderArena
 */
function renderSelection(mo) {
  const data = mo.data,
        view = mo.view,
        oray = mo.oray,
        pick = mo.pick;

  // get shadow color
  const color = mo.theme.selection;

  // clear overlay canvas
  const ctx = oray.getContext('2d');
  ctx.clearRect(0, 0, oray.width, oray.height);

  if (mo.cache.npick === 0) return;
  const n = mo.cache.nctg;
  if (!n) return;

  // prepare canvas
  ctx.save();
  ctx.translate(view.posX, view.posY);
  ctx.scale(view.scale, view.scale);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10; // note: canvas shadow blur is expensive
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // cache constant
  const pi2 = Math.PI * 2;

  // cache parameters
  const rbase = view.rbase;
  const w = oray.width,
        h = oray.height;
  const X = data[view.x.i],
        xscale = view.x.scale,
        xmin = view.x.min,
        xmax = view.x.max,
        dx = xmax - xmin;
  const Y = data[view.y.i],
        yscale = view.y.scale,
        ymin = view.y.min,
        ymax = view.y.max,
        dy = ymax - ymin;
  const si = view.size.i,
        S = si ? data[si] : null,
        sscale = view.size.scale,
        smin = view.size.zero ? 0 : view.size.min,
        slow = view.size.lower / 100,
        sfac = (view.size.upper / 100 - slow) / (view.size.max - smin);

  // render shadows around selected contigs
  let r, x, y;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (!pick[i]) continue;
    r = Math.round(si ? ((scaleNum(S[i], sscale) - smin) *
      sfac + slow) * rbase : rbase);
    x = Math.round(((scaleNum(X[i], xscale) - xmin) / dx - 0.5) * w);
    y = Math.round(((ymax - scaleNum(Y[i], yscale)) / dy - 0.5) * h);
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, 0, pi2, true);
  }
  ctx.fill();
  ctx.restore();
}


/**
 * Render polygon drawn by user.
 * @function drawPolygon
 * @param {Object} mo - main object
 * @see renderArena
 */
function drawPolygon(mo) {
  const view = mo.view,
        stat = mo.stat,
        oray = mo.oray;
  const vertices = stat.polygon;
  const pi2 = Math.PI * 2;
  const radius = 5 / view.scale;
  const color = mo.theme.polygon;
  const ctx = oray.getContext('2d');
  ctx.clearRect(0, 0, oray.width, oray.height);
  ctx.save();
  ctx.translate(view.posX, view.posY);
  ctx.scale(view.scale, view.scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const n = vertices.length;
  let vertex, j;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    vertex = vertices[i];
    ctx.arc(vertex.x, vertex.y, radius, 0, pi2, true);
    ctx.lineWidth = 1 / view.scale;
    ctx.moveTo(vertex.x, vertex.y);
    j = i + 1;
    if (j == n) j = 0;
    vertex = vertices[j];
    ctx.lineTo(vertex.x, vertex.y);
  }
  ctx.stroke();
  ctx.restore();
}


/**
 * Render graph grid.
 * @function drawGrid
 * @param {Object} rena - arena canvas DOM
 * @param {Object} view - view object
 * @todo needs further work
 */
function drawGrid(rena, view) {
  const ctx = rena.getContext('2d');
  ctx.font = (1 / view.scale).toFixed(2) + 'em monospace';
  ctx.fillStyle = 'dimgray';
  ctx.textAlign = 'center';
  ctx.lineWidth = 1 / view.scale;
  const ig = 5, gp = 10;
  let xx, yy;
  for (let x = parseInt(view.x.min / ig) * ig; x <= parseInt(view.x.max /
    ig) * ig; x += ig) {
    xx = ((x - view.x.min) / (view.x.max - view.x.min) - 0.5) * rena.width;
    ctx.moveTo(xx, -rena.height * 0.5);
    ctx.lineTo(xx, rena.height * 0.5);
    ctx.fillText(x.toString(), xx - gp / view.scale, (view.y.max /
      (view.y.max - view.y.min) - 0.5) * rena.height + gp / view.scale);
  }
  for (let y = parseInt(view.y.min / ig) * ig; y <= parseInt(view.y.max /
    ig) * ig; y += ig) {
    yy = ((view.y.max - y) / (view.y.max - view.y.min) - 0.5) * rena.height;
    ctx.moveTo(-rena.width * 0.5, yy);
    ctx.lineTo(rena.width * 0.5, yy);
    ctx.fillText(y.toString(), (view.x.min / (view.x.min - view.x.max) -
      0.5) * rena.width - gp / view.scale, yy + gp / view.scale);
  }
  ctx.strokeStyle = 'lightgray';
  ctx.stroke();
}


/**
 * Let user draw polygon to select a region of contigs.
 * @function polygonSelect
 * @param {Object} mo - main object
 * @param {boolean} shift - whether Shift key is processed
 */
function polygonSelect(mo, shift) {
  let n = mo.cache.nctg;
  if (!n) return;
  const data = mo.data,
        view = mo.view,
        stat = mo.stat,
        rena = mo.rena,
        oray = mo.oray;

  // change button appearance
  const btn = byId('polygon-btn');
  const title = btn.title;
  btn.title = btn.getAttribute('data-title');
  btn.setAttribute('data-title', title);
  btn.classList.toggle('pressed');

  // start drawing
  if (!stat.drawing) {
    stat.polygon = [];
    stat.drawing = true;
  }

  // finish drawing
  else {
    oray.getContext('2d').clearRect(0, 0, oray.width, oray.height);
    const X = data[view.x.i],
          Y = data[view.y.i];

    const mask = mo.mask;
    const ctgs = [];
    let x, y;
    for (let i = 0; i < n; i++) {
      if (!mask[i]) {
        x = ((scaleNum(X[i], view.x.scale) - view.x.min) /
          (view.x.max - view.x.min) - 0.5) * rena.width;
        y = ((view.y.max - scaleNum(Y[i], view.y.scale)) /
          (view.y.max - view.y.min) - 0.5) * rena.height;
        if (pnpoly(x, y, stat.polygon)) ctgs.push(i);
      }
    }
    stat.polygon = [];
    stat.drawing = false;

    // treat selection
    treatSelection(ctgs, mo, shift);
  }
}


/**
 * Take a screenshot and export as a PNG image.
 * @function exportPNG
 * @param {Object} canvas - canvas DOM to export
 */
 function exportPNG(canvas) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'image.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

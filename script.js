(() => {
  'use strict';
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.querySelector('#motion-toggle');
  let motionPaused = reduceMotion.matches;
  let manuallySetMotion = false;
  let renderNetwork = () => {};
  let cancelNetwork = () => {};

  function applyMotion() {
    body.classList.toggle('motion-paused', motionPaused);
    document.documentElement.classList.toggle('motion-paused', motionPaused);
    motionButton.setAttribute('aria-pressed', String(motionPaused));
    motionButton.innerHTML = motionPaused ? 'Resume animations <span aria-hidden="true">▶</span>' : 'Pause animations <span aria-hidden="true">Ⅱ</span>';
    if (motionPaused || document.hidden) cancelNetwork();
    else renderNetwork();
  }
  motionButton.addEventListener('click', () => {
    manuallySetMotion = true;
    motionPaused = !motionPaused;
    applyMotion();
  });
  reduceMotion.addEventListener('change', () => {
    if (!manuallySetMotion) {
      motionPaused = reduceMotion.matches;
      applyMotion();
    }
  });
  document.addEventListener('visibilitychange', applyMotion);
  applyMotion();
  document.querySelector('.site-controls').hidden = false;

  const filters = document.querySelector('.filters');
  const projects = [...document.querySelectorAll('.project')];
  const filterButtons = [...filters.querySelectorAll('button')];
  filterButtons.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    projects.forEach(project => {
      project.hidden = filter !== 'all' && project.dataset.category !== filter;
      if (!project.hidden) count++;
    });
    document.querySelector('#filter-status').textContent = `${count} projects shown.`;
  }));
  filters.hidden = false;
  document.querySelector('#year').textContent = String(new Date().getFullYear());

  let scrollScheduled = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    document.querySelector('.reading-progress').style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
    scrollScheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollScheduled) {
      scrollScheduled = true;
      requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  const canvas = document.querySelector('#network');
  const context = canvas.getContext('2d');
  if (!context) return;
  const art = canvas.closest('.network-art');
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const restingPitch = -.24;
  let width = 0;
  let height = 0;
  let frame = null;
  let lastTime = null;
  let variant = 0;
  let visible = true;
  let yaw = 0;
  let pitch = restingPitch;
  let targetYaw = yaw;
  let targetPitch = pitch;
  let keyboardControl = false;
  let drag = null;
  let hoverOrigin = null;
  let points = [];
  let edges = [];
  let projected = [];
  const pointer = { x: 0, y: 0, active: false };
  const attraction = { x: 0, y: 0, strength: 0 };

  function arrange() {
    points = Array.from({ length: 100 }, (_, index) => {
      const y = 1 - index / 99 * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = index * (Math.PI * (3 - Math.sqrt(5)) + variant * .013) + variant;
      return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
    });
    // Connectivity changes only when the arrangement changes, not every frame.
    edges = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dz = points[i].z - points[j].z;
        if (dx * dx + dy * dy + dz * dz < .45 * .45) edges.push([i, j]);
      }
    }
    projected = points.map(() => ({ x: 0, y: 0, z: 0, influence: 0 }));
  }

  function paint() {
    context.clearRect(0, 0, width, height);
    const radius = Math.min(width * .38, height * .42);
    const reach = Math.max(65, radius * .72);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    points.forEach((point, index) => {
      const x = point.x * cosYaw - point.z * sinYaw;
      const z = point.x * sinYaw + point.z * cosYaw;
      const y = point.y * cosPitch - z * sinPitch;
      const depth = point.y * sinPitch + z * cosPitch;
      const screenX = width / 2 + x * radius;
      const screenY = height / 2 + y * radius;
      const dx = attraction.x - screenX;
      const dy = attraction.y - screenY;
      const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / reach);
      const influence = proximity * proximity * attraction.strength * (.45 + (depth + 1) * .275);
      const view = projected[index];
      view.x = screenX + dx * influence * .22;
      view.y = screenY + dy * influence * .22;
      view.z = depth;
      view.influence = influence;
    });
    edges.forEach(([i, j]) => {
      const a = projected[i];
      const b = projected[j];
      const influence = Math.max(a.influence, b.influence);
      const opacity = .13 + (a.z + b.z + 2) * .085;
      context.strokeStyle = influence > .035
        ? `rgba(211,162,126,${Math.min(.85, opacity + influence * .6)})`
        : `rgba(238,233,223,${opacity})`;
      context.lineWidth = .7 + influence * 1.7;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    });
    projected.forEach((point, index) => {
      const size = (point.z + 1.2) * .9 + (index % 17 === 0 ? 1.8 : .35) + point.influence * 3;
      context.fillStyle = point.influence > .07
        ? `rgba(211,162,126,${.6 + point.influence * .4})`
        : `rgba(238,233,223,${.38 + (point.z + 1) * .29})`;
      context.beginPath();
      context.arc(point.x, point.y, size, 0, Math.PI * 2);
      context.fill();
      if (point.influence > .22) {
        context.strokeStyle = `rgba(211,162,126,${point.influence * .55})`;
        context.lineWidth = .8;
        context.beginPath();
        context.arc(point.x, point.y, size + 4, 0, Math.PI * 2);
        context.stroke();
      }
    });
  }

  function draw(time) {
    frame = null;
    if (motionPaused || !visible || document.hidden) {
      lastTime = null;
      return;
    }
    const delta = lastTime === null ? 16 : Math.min(time - lastTime, 50);
    lastTime = time;
    const ease = 1 - Math.exp(-delta / 95);
    // Drift yields completely to the visitor while they explore the sketch.
    if (!pointer.active && !drag && !keyboardControl) targetYaw += delta * .00014;
    yaw += (targetYaw - yaw) * ease;
    pitch += (targetPitch - pitch) * ease;
    attraction.x += (pointer.x - attraction.x) * ease;
    attraction.y += (pointer.y - attraction.y) * ease;
    attraction.strength += ((pointer.active ? 1 : 0) - attraction.strength) * ease;
    paint();
    frame = requestAnimationFrame(draw);
  }

  cancelNetwork = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
  };
  renderNetwork = () => {
    if (!visible || document.hidden || width === 0 || height === 0) return;
    if (motionPaused) {
      // Deliberate input can change the still image without starting an animation.
      yaw = targetYaw;
      pitch = targetPitch;
      attraction.strength = 0;
      paint();
    } else if (frame === null) {
      frame = requestAnimationFrame(draw);
    }
  };

  function resize() {
    // Layout dimensions avoid stretching the drawing inside its rotated frame.
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!pointer.active) {
      pointer.x = attraction.x = width / 2;
      pointer.y = attraction.y = height / 2;
    }
    renderNetwork();
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    // Invert the art's decorative rotation so the highlighted nodes stay under
    // the actual pointer instead of following the axis-aligned bounding box.
    const matrix = new DOMMatrixReadOnly(getComputedStyle(art).transform);
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    return {
      x: (matrix.d * dx - matrix.c * dy) / determinant + width / 2,
      y: (-matrix.b * dx + matrix.a * dy) / determinant + height / 2
    };
  }

  function setPointer(point) {
    pointer.x = clamp(point.x, 0, width);
    pointer.y = clamp(point.y, 0, height);
    pointer.active = true;
  }

  function startHover(point) {
    hoverOrigin = { x: point.x, y: point.y, yaw: targetYaw, pitch: targetPitch };
    setPointer(point);
  }

  function setKeyboardControl(active) {
    keyboardControl = active;
    art.classList.toggle('network-keyboard', active);
  }

  function clearPointer() {
    pointer.active = false;
    hoverOrigin = null;
  }

  function finishDrag(event) {
    if (!drag || (event && drag.id !== event.pointerId)) return;
    const ended = drag;
    drag = null;
    art.classList.remove('network-dragging');
    if (canvas.hasPointerCapture(ended.id)) canvas.releasePointerCapture(ended.id);
    if (ended.type === 'touch' || !event || event.type === 'pointercancel') {
      clearPointer();
    } else {
      const point = localPoint(event);
      if (point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height) startHover(point);
      else clearPointer();
    }
  }

  canvas.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch' || motionPaused || drag) return;
    setKeyboardControl(false);
    startHover(localPoint(event));
    renderNetwork();
  }, { passive: true });

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || width === 0) return;
    const point = localPoint(event);
    setKeyboardControl(false);
    // A touch becomes a drag only after a horizontal intent is apparent.
    drag = {
      id: event.pointerId, type: event.pointerType,
      x: point.x, y: point.y, yaw, pitch,
      active: event.pointerType !== 'touch'
    };
    targetYaw = yaw;
    targetPitch = pitch;
    if (drag.active) {
      canvas.setPointerCapture(event.pointerId);
      art.classList.add('network-dragging');
      setPointer(point);
      canvas.focus({ preventScroll: true });
      setKeyboardControl(false);
    }
    renderNetwork();
  }, { passive: true });

  canvas.addEventListener('pointermove', event => {
    if (!event.isPrimary) return;
    const point = localPoint(event);
    if (drag && drag.id === event.pointerId) {
      const dx = point.x - drag.x;
      const dy = point.y - drag.y;
      if (!drag.active) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
          finishDrag();
          return;
        }
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
        drag.active = true;
        canvas.setPointerCapture(event.pointerId);
        art.classList.add('network-dragging');
      }
      targetYaw = drag.yaw + dx / width * Math.PI * 2;
      targetPitch = clamp(drag.pitch + dy / height * Math.PI, -1.15, 1.15);
      setPointer(point);
      renderNetwork();
    } else if (event.pointerType !== 'touch' && !motionPaused) {
      setKeyboardControl(false);
      if (!hoverOrigin) startHover(point);
      targetYaw = hoverOrigin.yaw + (point.x - hoverOrigin.x) / width * 1.6;
      targetPitch = clamp(hoverOrigin.pitch + (point.y - hoverOrigin.y) / height * 1.1, -1.15, 1.15);
      setPointer(point);
      renderNetwork();
    }
  }, { passive: true });

  canvas.addEventListener('pointerleave', () => {
    if (!drag) clearPointer();
  }, { passive: true });
  canvas.addEventListener('pointerup', finishDrag, { passive: true });
  canvas.addEventListener('pointercancel', finishDrag, { passive: true });
  canvas.addEventListener('lostpointercapture', () => {
    if (drag) {
      drag = null;
      art.classList.remove('network-dragging');
      clearPointer();
    }
  });
  canvas.addEventListener('focus', () => {
    if (canvas.matches(':focus-visible')) setKeyboardControl(true);
  });
  canvas.addEventListener('blur', () => {
    setKeyboardControl(false);
    if (!drag) clearPointer();
  });
  canvas.addEventListener('keydown', event => {
    if (document.activeElement !== canvas || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    setKeyboardControl(true);
    hoverOrigin = null;
    if (event.key === 'ArrowLeft') targetYaw -= .24;
    if (event.key === 'ArrowRight') targetYaw += .24;
    if (event.key === 'ArrowUp') targetPitch -= .18;
    if (event.key === 'ArrowDown') targetPitch += .18;
    if (event.key === 'Home') {
      // Return by the shortest turn, even after several full drag rotations.
      targetYaw = yaw - Math.atan2(Math.sin(yaw), Math.cos(yaw));
      targetPitch = restingPitch;
    }
    targetPitch = clamp(targetPitch, -1.15, 1.15);
    setPointer({ x: width / 2, y: height / 2 });
    renderNetwork();
  });

  // Losing the surface must not leave a captured drag or a stale hover behind.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { finishDrag(); clearPointer(); }
  });
  window.addEventListener('blur', () => { finishDrag(); clearPointer(); });

  arrange();
  art.classList.add('canvas-ready');
  canvas.tabIndex = 0;
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) renderNetwork();
      else { cancelNetwork(); finishDrag(); clearPointer(); }
    }).observe(art);
  }
  art.querySelector('.rewire').addEventListener('click', () => {
    variant += .55;
    arrange();
    renderNetwork();
  });
  art.querySelector('.rewire').hidden = false;
  resize();
})();

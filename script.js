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
  let width = 0;
  let height = 0;
  let frame = null;
  let angle = 0;
  let variant = 0;
  let visible = true;
  let pointerX = 0;
  let pointerY = 0;
  let lastTime = null;
  let points = [];

  function arrange() {
    points = Array.from({ length: 100 }, (_, index) => {
      const y = 1 - index / 99 * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = index * (Math.PI * (3 - Math.sqrt(5)) + variant * .013) + variant;
      return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
    });
  }
  function draw(time = 0) {
    context.clearRect(0, 0, width, height);
    const radius = Math.min(width * .38, height * .42);
    const yaw = angle + pointerX * .3;
    const pitch = -.24 + pointerY * .2;
    const projected = points.map(point => {
      const x = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
      const z = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
      const y = point.y * Math.cos(pitch) - z * Math.sin(pitch);
      const depth = point.y * Math.sin(pitch) + z * Math.cos(pitch);
      return { x: width / 2 + x * radius, y: height / 2 + y * radius, z: depth };
    });
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y, points[i].z - points[j].z);
        if (distance < .45) {
          const opacity = .12 + (projected[i].z + projected[j].z + 2) * .095;
          context.strokeStyle = `rgba(24,34,29,${opacity})`;
          context.lineWidth = .7;
          context.beginPath();
          context.moveTo(projected[i].x, projected[i].y);
          context.lineTo(projected[j].x, projected[j].y);
          context.stroke();
        }
      }
    }
    projected.forEach((point, index) => {
      const size = (point.z + 1.2) * .9 + (index % 17 === 0 ? 2 : 0);
      context.fillStyle = `rgba(24,34,29,${.25 + (point.z + 1) * .35})`;
      context.beginPath();
      context.arc(point.x, point.y, size, 0, Math.PI * 2);
      context.fill();
    });
    if (!motionPaused && visible && !document.hidden) {
      const delta = lastTime === null ? 0 : Math.min(time - lastTime, 50);
      angle += delta * .00008;
      lastTime = time;
      frame = requestAnimationFrame(draw);
    } else {
      frame = null;
      lastTime = null;
    }
  }
  cancelNetwork = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
  };
  renderNetwork = () => {
    if (frame === null && visible && !document.hidden) {
      if (motionPaused) draw();
      else frame = requestAnimationFrame(draw);
    }
  };
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (motionPaused || !visible) draw();
    else renderNetwork();
  }
  arrange();
  art.classList.add('canvas-ready');
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) renderNetwork();
      else cancelNetwork();
    }, { rootMargin: '100px' }).observe(art);
  }
  art.addEventListener('pointermove', event => {
    if (motionPaused) return;
    const rect = art.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - .5;
    pointerY = (event.clientY - rect.top) / rect.height - .5;
  }, { passive: true });
  art.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  art.querySelector('.rewire').addEventListener('click', () => {
    variant += .55;
    arrange();
    if (motionPaused) draw();
    else renderNetwork();
  });
  art.querySelector('.rewire').hidden = false;
  resize();
})();

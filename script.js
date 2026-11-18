const lens = document.querySelector('#lens');
const avatar = document.querySelector('#avatarSlot');
const body = document.body;
const modal = document.querySelector('#modal');
const login = document.querySelector('#login');
const close = document.querySelector('#close');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pause = (time) => new Promise((resolve) => setTimeout(resolve, time));

function placeLens({ left, top, width, height, opacity = 1 }) {
  Object.assign(lens.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, opacity });
}

async function moveLens(to, duration, easing = 'cubic-bezier(.65,0,.25,1)') {
  const from = lens.getBoundingClientRect();
  const animation = lens.animate([
    { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, transform: 'rotate(-10deg)' },
    { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, transform: `rotate(${to.rotate || 0}deg)` }
  ], { duration, easing, fill: 'forwards' });
  await animation.finished;
  animation.cancel();
  placeLens(to);
}

async function intro() {
  const startSize = Math.min(window.innerWidth < 720 ? 120 : 154, window.innerWidth * .4);
  const target = avatar.getBoundingClientRect();
  const finalSize = target.width - 3;
  const targetPosition = { left: target.left + 1.5, top: target.top + 1.5, width: finalSize, height: finalSize };

  if (reduceMotion) {
    placeLens(targetPosition);
    body.classList.add('ready');
    return;
  }

  placeLens({ left: -startSize, top: window.innerHeight * .64, width: startSize, height: startSize, opacity: 0 });
  body.classList.add('opening');
  lens.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 130, fill: 'forwards' });
  await moveLens({ left: window.innerWidth * .42, top: window.innerHeight * .40, width: startSize, height: startSize, rotate: -4 }, 780);

  body.classList.add('scanning');
  await moveLens({ left: window.innerWidth * .23, top: window.innerHeight * .26, width: startSize * .88, height: startSize * .88, rotate: 11 }, 430, 'cubic-bezier(.2,.8,.2,1)');
  await pause(150);
  await moveLens({ left: window.innerWidth * .63, top: window.innerHeight * .52, width: startSize * .95, height: startSize * .95, rotate: -9 }, 510, 'cubic-bezier(.2,.8,.2,1)');
  await pause(120);
  await moveLens({ left: window.innerWidth * .44, top: window.innerHeight * .39, width: startSize, height: startSize, rotate: 2 }, 380, 'cubic-bezier(.2,.8,.2,1)');

  body.classList.remove('scanning');
  await moveLens(targetPosition, 720, 'cubic-bezier(.34,1.35,.64,1)');
  body.classList.add('ready');
}

window.addEventListener('load', intro, { once: true });
login.addEventListener('click', () => { modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false'); });
close.addEventListener('click', () => { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); });
modal.addEventListener('click', (event) => { if (event.target === modal) close.click(); });

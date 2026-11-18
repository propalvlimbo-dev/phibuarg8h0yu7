const modal = document.querySelector('#modal');
const open = document.querySelector('#openModal');
const close = document.querySelector('#closeModal');
const form = document.querySelector('#waitlistForm');
const message = document.querySelector('#formMessage');

function toggleModal(show) {
  modal.classList.toggle('visible', show);
  modal.setAttribute('aria-hidden', String(!show));
  if (show) modal.querySelector('input').focus();
}

open.addEventListener('click', () => toggleModal(true));
close.addEventListener('click', () => toggleModal(false));
modal.addEventListener('click', (event) => { if (event.target === modal) toggleModal(false); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggleModal(false); });
form.addEventListener('submit', (event) => {
  event.preventDefault();
  message.textContent = 'Готово — мы сохранили твоё место в очереди.';
  form.reset();
});

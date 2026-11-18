const dialog = document.querySelector('#dialog');
const openButtons = [document.querySelector('#openDialog'), document.querySelector('#openDialogSecond')];
const closeButton = document.querySelector('#closeDialog');
const form = document.querySelector('#waitlist');
const formText = document.querySelector('#formText');

openButtons.forEach((button) => button.addEventListener('click', () => dialog.showModal()));
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  formText.textContent = 'Готово. Скоро отправим приглашение.';
  form.reset();
});

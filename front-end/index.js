const elemento = document.getElementById("saida");
const input = document.getElementById("input");
const button = document.getElementById("button");

button.addEventListener("click", () => {
  // input.value retorna sempre uma string. .trim() remove espaços em branco acidentais.
  if (input.value.trim()) {
    elemento.textContent = input.value;
  } else {
    elemento.textContent = ""; // limpa caso digite outro valor
  }
});

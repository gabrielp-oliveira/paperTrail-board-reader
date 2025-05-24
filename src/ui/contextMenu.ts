export function showContextMenu(x: number, y: number, options: string[]) {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (!menu) return;

  // Limpa opções antigas
  menu.innerHTML = "";

  // Cria opções novas
  options.forEach(option => {
    const item = document.createElement("div");
    item.className = "context-menu-item";
    item.textContent = option;
    item.onclick = () => {
      console.log("🔘 Opção selecionada:", option);
      hideContextMenu();
    };
    menu.appendChild(item);
  });

  // Posiciona e exibe
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "block";
}

export function hideContextMenu() {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (menu) {
    menu.style.display = "none";
  }
}

// Fecha ao clicar fora
document.addEventListener("click", () => hideContextMenu());

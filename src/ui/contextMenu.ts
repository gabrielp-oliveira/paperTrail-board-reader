let activeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let activeClickHandler: ((e: MouseEvent) => void) | null = null;

export function showContextMenu(
  x: number,
  y: number,
  options: string[],
  chapterId: string,
  zoomScale: number = 1
) {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (!menu) return;

  // 🧼 Limpa o conteúdo anterior
  menu.innerHTML = "";

  // 🔁 Cria opções dinamicamente
  options.forEach(option => {
    const item = document.createElement("div");
    item.className = "context-menu-item";
    item.textContent = option;

    item.onclick = () => {
      window.parent.postMessage(
        {
          type: "chapter-option-selected",
          data: {
            chapterId,
            option
          }
        },
        "*"
      );
      hideContextMenu();
    };

    // Padding proporcional ao zoom
    item.style.padding = `${6 / zoomScale}px ${12 / zoomScale}px`;
    menu.appendChild(item);
  });

  // Posiciona o menu
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "block";

  // Escala visual do menu
  menu.style.setProperty("--scale", `${zoomScale}`);
  menu.style.fontSize = `${14 / zoomScale}px`;

  // Remove listeners anteriores para evitar acúmulo
  if (activeClickHandler) {
    document.removeEventListener("click", activeClickHandler);
  }
  if (activeKeyHandler) {
    document.removeEventListener("keydown", activeKeyHandler);
  }

  // ✅ Fecha ao clicar fora
  setTimeout(() => {
    activeClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#context-menu")) {
        hideContextMenu();
      }
    };
    document.addEventListener("click", activeClickHandler);
  });

  // ✅ Fecha com ESC
  activeKeyHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      hideContextMenu();
    }
  };
  document.addEventListener("keydown", activeKeyHandler);
}

export function hideContextMenu() {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (menu) {
    menu.style.display = "none";
  }

  if (activeClickHandler) {
    document.removeEventListener("click", activeClickHandler);
    activeClickHandler = null;
  }
  if (activeKeyHandler) {
    document.removeEventListener("keydown", activeKeyHandler);
    activeKeyHandler = null;
  }
}

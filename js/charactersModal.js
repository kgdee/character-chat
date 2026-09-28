const CharactersModal = (() => {
  const element = document.querySelector(".characters-modal");
  const itemsGrid = element.querySelector(".items-grid");

  function updateUI() {
    itemsGrid.innerHTML = currentCharacters
      .map((item) => {
        item = formatCharacter(item);

        return `
          <div class="item" onclick="CharactersModal.handleItemClick('${item.name}')">
            <img src="${item.image}">
            <div class="item-body">
              <div class="name truncated">${item.name}</div>
              <div class="desc truncated-3">${item.intro}</div>
            </div>
          </div>  
        `;
      })
      .join("");
  }

  function handleItemClick(itemName) {
    const item = currentCharacters.filter((item) => item.name === itemName)[0];
    applyCharacter(item);
    close();
  }

  function open() {
    updateUI();
    element.classList.toggle("hidden", false);
  }

  function close() {
    element.classList.toggle("hidden", true);
  }

  return { open, close, handleItemClick };
})();

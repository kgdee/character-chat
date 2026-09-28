const CharacterModal = (() => {
  const element = document.querySelector(".character-modal");
  const titleEl = element.querySelector(".title");
  const nameInput = element.querySelector(".name-input");
  const genderInput = element.querySelector(".gender-input");
  const introInput = element.querySelector(".intro-input");
  const greetingInput = element.querySelector(".greeting-input");
  const backgroundInput = element.querySelector(".background-input");
  const imageInput = element.querySelector(".image-input input");
  const imagePreview = element.querySelector(".image-input img");
  const submitBtn = element.querySelector(".submit-btn");
  const deleteBtn = element.querySelector(".delete-btn");

  let currentItem = null;

  imageInput.oninput = (event) => {
    const file = event.target.files[0];
    imagePreview.src = URL.createObjectURL(file);
  };

  submitBtn.onclick = handleSubmit;
  deleteBtn.onclick = handleDelete;

  function openCreate() {
    update();
    open();
  }

  function openUpdate(itemId) {
    const item = getItem(itemId);
    currentItem = item;
    update();
    open();
  }

  function update() {
    nameInput.value = currentItem?.name || "";
    genderInput.value = currentItem?.gender || "female";
    imageInput.value = "";
    imagePreview.src = currentItem?.image || `assets/images/default-avatar.jpg`;
    titleEl.textContent = currentItem ? `Edit ${currentItem.name}` : `Create new character`;
    introInput.value = currentItem?.intro || "";
    greetingInput.value = currentItem?.greeting || "";
    backgroundInput.value = currentItem?.background || "";

    submitBtn.innerHTML = currentItem ? `Update` : `Create`;
    deleteBtn.classList.toggle("hidden", !currentItem);
  }

  async function handleSubmit() {
    const itemData = {
      name: nameInput.value,
      gender: genderInput.value,
      image: imageInput.value ? await getFileDataUrl(imageInput.files[0]) : currentItem?.image || null,
      intro: introInput.value,
      greeting: greetingInput.value,
      background: backgroundInput.value,
    };

    if (currentItem) {
      itemData.id = currentItem.id;
      updateCharacter(itemData);
    } else {
      createCharacter(itemData);
    }

    close();
  }

  async function handleDelete() {
    await deleteCharacter(currentItem.id);
    close();
  }

  function open() {
    element.classList.toggle("hidden", false);
  }

  function close() {
    element.classList.toggle("hidden", true);
    currentItem = null;
  }

  return { openCreate, openUpdate, close };
})();

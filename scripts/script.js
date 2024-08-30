const joinRoom = document.querySelector(".joinRoom");

joinRoom.addEventListener("click", () => {
  const roomId = prompt("Please enter room ID");
  window.location.href = `./room.html?room=${roomId}`;
});

/** ---------------- DOM 관련 변수 --------------------- */
const leaveBtn = document.querySelector(".leaveRoom");
const title = document.querySelector(".title");
const players = document.querySelector(".players");
const startBtn = document.querySelector(".start");

/** ---------------- Socket 관련 변수 --------------------- */
let socket, universeName, roomId;
let playerId = null;
let otherPlayers = {};

/** ---------------- 게임 관련 변수 --------------------- */
let scene, camera, renderer, player, floor;
let playerSpeed = 0.1; // 기본 플레이어 이동 속도
let jumpSpeed = 0.3; // 기본 플레이어 점프 속도
let gravity = 0.01; // 플레이어에게 가해지는 중력의 크기 ( 점프 시 바닥으로 끌어당김 )
let isJumping = false; // 플레이어가 점프 중인지 저장
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false; // 키보드 입력 시 어디로 이동할지 저장
let mouseSensitivity = 0.003; // 마우스 감도
let yaw = 0;
let pitch = 0;
let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2; 
const pitchLimit = Math.PI / 36;
let floorY = -1;

/** -------------------- 함수 선언부 -------------------------- */
/***
 * 게임 화면 초기화
 */
function init() {
  document.body.innerHTML = '';

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({
    canvas: document.body.appendChild(document.createElement("canvas")),
    antialias: false,
    logarithmicDepthBuffer: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
  const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  player = new THREE.Mesh(playerGeometry, playerMaterial);
  scene.add(player);

  const floorGeometry = new THREE.PlaneGeometry(100, 100);
  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  scene.add(floor);

  camera.position.set(0, 0.9, 0);
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  player.add(camera);

  animate();
}

/**
 * 대기실 설정
 * @param {*} data 
 */
function changeRoomData (data) {
  document.title = `Room ${data.id} | GalaxyWar`;
  title.textContent = `Welcome to ${data.id} Universe ...`;
  players.textContent = `Players : ${data.players ? data.players : 0}/6`;
}

const leaveRoomHandler = (socket) => {
  socket.emit("leaveRoom");
  window.location.href = "./index.html";
};

const copyRoomNameHandler = () => {
  window.navigator.clipboard.writeText(
    `http://localhost:5500/room.html?${universeName}`
  );
  alert(`Room URL copied`);
};

const gameStartHandler = (socket) => {
  socket.emit("gameStart", universeName.split("=")[1]);
};

document.addEventListener('mousemove', (event) => {
  // Calculate changes in mouse position
  const deltaX = event.movementX;
  const deltaY = event.movementY;

  // Adjust yaw and pitch based on mouse movement
  yaw -= deltaX * mouseSensitivity;

  // Reduce the vertical sensitivity to prevent excessive vertical movement
  pitch -= deltaY * (mouseSensitivity / 2); // Lower sensitivity for pitch

  // Clamp pitch to stay within ±30 degrees
  pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));

  // Update camera rotation
  camera.rotation.set(pitch, yaw, 0);
}, false);

document.addEventListener("keyup", (event) => {
 switch (event.key) {
   case "ArrowUp":
   case "w":
     moveForward = false;
     break;
   case "ArrowDown":
   case "s":
     moveBackward = false;
     break;
   case "ArrowLeft":
   case "a":
     moveLeft = false;
     break;
   case "ArrowRight":
   case "d":
     moveRight = false;
     break;
 }
});

document.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowUp":
    case "w":
      moveForward = true;
      break;
    case "ArrowDown":
    case "s":
      moveBackward = true;
      break;
    case "ArrowLeft":
    case "a":
      moveLeft = true;
      break;
    case "ArrowRight":
    case "d":
      moveRight = true;
      break;
    case " ":
      if (!isJumping) {
        isJumping = true;
        jumpVelocity = jumpSpeed;
      }
      break;
  }
});


leaveBtn.addEventListener("click", () => leaveRoomHandler(socket));
title.addEventListener("click", copyRoomNameHandler);
startBtn.addEventListener("click", () => {
  gameStartHandler(socket);
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


/** ------------------- 소켓 함수 ------------------------------ */
socket = io("http://localhost:3000");
universeName = window.location.search.slice(1);
roomId = universeName.split("=")[1];

if (universeName.length === 0) {
  socket.emit("createRoom");
  socket.on("roomCreated", ({ roomId }) => {
    window.location.href = `./room.html?room=${roomId}`;
  });
}

socket.emit("joinRoom", roomId);
socket.on("joinedRoom", (data) => {
  changeRoomData(data);
});

socket.on("startedGame", (data) => {
  alert(data.message);
  socket.emit("gameInit", roomId);
  init();
});

socket.on("error", (message) => {
  alert(message);
  if (message === "Room not found") window.location.href = "./index.html";
});

socket.on("playerJoined", (data) => {
  console.log(`Player joined: ${data.id}`);
  changeRoomData({id: roomId, players:data.players})
});

socket.on("playerDisconnected", (data) => {
  console.log(`Player disconnected: ${data.id}`);
  changeRoomData({id: roomId, players:data.players})
});

socket.on("initPlayer", (data) => {
  console.log(data);
  playerId = data.id;
  data.players.forEach((user) => {
    if (user.id !== playerId) {
      createOtherPlayer(user.id, user.camp, user.position);
    }
  });
});

socket.on("update", (data) => {
  if (otherPlayers[data.id]) {
    otherPlayers[data.id].position.set(data.x, data.y, data.z);
  }
});

socket.on("remove", (id) => {
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }
});

function createOtherPlayer(id, camp, position = { x: 0, y: 0, z: 0 }) {
  const otherPlayerGeometry = new THREE.BoxGeometry(1, 1, 1);
  const otherPlayerMaterial = new THREE.MeshBasicMaterial({
    color: camp === "RED" ? 0xff0000 : 0x0000ff,
  });
  const otherPlayer = new THREE.Mesh(otherPlayerGeometry, otherPlayerMaterial);
  otherPlayer.position.set(position.x, position.y, position.z);
  scene.add(otherPlayer);
  otherPlayers[id] = otherPlayer;
}


function update() {
  const moveDirection = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

  // Calculate movement direction
  if (moveForward) moveDirection.add(forward.clone().multiplyScalar(playerSpeed));
  if (moveBackward) moveDirection.add(forward.clone().multiplyScalar(-playerSpeed));
  if (moveLeft) moveDirection.add(right.clone().multiplyScalar(-playerSpeed));
  if (moveRight) moveDirection.add(right.clone().multiplyScalar(playerSpeed));

  // Update player position
  if (isJumping) {
    player.position.y += jumpVelocity;
    jumpVelocity -= gravity;
    if (player.position.y <= floorY + 0.5) {
      player.position.y = floorY + 0.5;
      isJumping = false;
      jumpVelocity = 0;
    }
  } 
  
  if (!isJumping) {
    player.position.y = 0;
  } 

  player.position.add(moveDirection);

  // Ensure player stays within bounds
  if (player.position.x < -10) player.position.x = -10;
  if (player.position.x > 10) player.position.x = 10;
  if (player.position.z < -10) player.position.z = -10;
  if (player.position.z > 10) player.position.z = 10;
  if (player.position.y < floorY + 0.5) {
    player.position.y = floorY + 0.5;
  }

  // Align player box rotation with camera direction
  // const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  // player.rotation.y = Math.atan2(direction.x, direction.z);

  player.rotation.copy(camera.rotation + pitchLimit);

  socket.emit("move", {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    roomId: roomId,
  });
}

function animate() {
  requestAnimationFrame(animate);
  update();
  renderer.render(scene, camera);
}
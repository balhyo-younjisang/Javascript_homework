/** ---------------- DOM 관련 변수 --------------------- */
const leaveBtn = document.querySelector(".leaveRoom");
const title = document.querySelector(".title");
const players = document.querySelector(".players");
const startBtn = document.querySelector(".start");

/** ---------------- Socket 관련 변수 --------------------- */
let socket, universeName, roomId;
let playerId = null;
let playersObj = {};

/** ---------------- 게임 관련 변수 --------------------- */
let scene, camera, renderer, player, floor, weapon;
let playerSpeed = 0.1; // 기본 플레이어 이동 속도
let jumpSpeed = 0.3; // 기본 플레이어 점프 속도
let gravity = 0.01; // 플레이어에게 가해지는 중력의 크기 ( 점프 시 바닥으로 끌어당김 )
let isJumping = false; // 플레이어가 점프 중인지 저장
let moveForward = false,
  moveBackward = false,
  moveLeft = false,
  moveRight = false; // 키보드 입력 시 어디로 이동할지 저장
let mouseSensitivity = 0.003; // 마우스 감도
let yaw = 0;
let pitch = 0;
let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;
const pitchLimit = Math.PI / 36;
let floorY = -1;
let buildings = []; // 빌딩의 위치 저장
let isFiring = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const bulletSpeed = 10; // 총알 속도
const bullets = []; // 총알의 데이터 저장

/** -------------------- 함수 선언부 -------------------------- */
/***
 * 게임 화면 초기화
 */
function init() {
  document.body.innerHTML = "";

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

  createBuilding(5, 0, 5, 2, 6, 20);
  createBuilding(-5, 0, 10, 3, 9, 3);
  createBuilding(10, 0, -5, 4, 7, 4);
  createBuilding(-10, 0, -10, 2, 10, 2);
  createBuilding(-30, 0, -20, 5, 30, 2);

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
  weapon = createWeapon();
  player.add(weapon);
  playersObj[player.uuid] = {object: player, weapon, bullets: []};

  animate();
}

function handlePlayerDeath(playerId) {
  const player = players[playerId];
  if (player) {
      console.log(`Player ${playerId} has died. Handle accordingly.`);
      scene.remove(player.mesh);
  }
}

/**
 * 대기실 설정
 * @param {*} data
 */
function changeRoomData(data) {
  document.title = `Room ${data.id} | GalaxyWar`;
  title.textContent = `Welcome to ${data.id} Universe ...`;
  players.textContent = `Players : ${data.players ? data.players : 0}/6`;
}


/** 건물 생성 */
function createBuilding(x, y, z, width, height, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const building = new THREE.Mesh(geometry, material);

  building.position.set(x, y, z);
  scene.add(building);

  buildings.push(building);
}

/** 룸 번호 클릭 시 URL 복사 */
function copyRoomNameHandler() {
  window.navigator.clipboard.writeText(
    `http://localhost:5500/room.html?${universeName}`
  );
  alert(`Room URL copied`);
}


function gameStartHandler(socket) {
  socket.emit("gameStart", universeName.split("=")[1]);
}

document.addEventListener(
  "mousemove",
  (event) => {
    const deltaX = event.movementX;
    const deltaY = event.movementY;
    yaw -= deltaX * mouseSensitivity;

    pitch -= deltaY * (mouseSensitivity / 2);
    pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
    camera.rotation.set(pitch, yaw, 0);

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  },
  false
);

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

leaveBtn.addEventListener("click", () => window.location.href = '/');
title.addEventListener("click", copyRoomNameHandler);
startBtn.addEventListener("click", () => {
  gameStartHandler(socket);
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('mousedown', (event) => {
  if (event.button === 0) { // 좌클릭일 경우
      createBullet(player);
  }
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
  changeRoomData({ id: roomId, players: data.players });
});

socket.on("playerDisconnected", (data) => {
  console.log(`Player disconnected: ${data.id}`);
  changeRoomData({ id: roomId, players: data.players });
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
  if (playersObj[data.id]) {
    playersObj[data.id].playerId.position.set(data.x, data.y, data.z);
  }
});

socket.on('newBullet', (bulletData) => {
  const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

  bullet.position.copy(new THREE.Vector3().copy(bulletData.position));
  bullet.userData.velocity = new THREE.Vector3().copy(bulletData.direction);

  scene.add(bullet);
  bullets.push(bullet);
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
  const otherPlayerWeapon = createWeapon();
  otherPlayerWeapon.position.set(0, 0, -1); // 위치 설정
  otherPlayer.add(otherPlayerWeapon);
  playersObj[id] = {playerId : otherPlayer, weapon: otherPlayerWeapon, bullets: []}
}

/** 무기 생성 */
function createWeapon() {
  const weaponGeometry = new THREE.BoxGeometry(0.5, 0.5, 1); // 무기 모델의 크기 조정
  const weaponMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // 검은색
  const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
  weapon.position.set(1, -0.5, -1); // 플레이어 앞쪽에 위치하도록 설정
  weapon.rotation.set(0, 0, 0); // 기본 방향으로 회전 설정
  return weapon;
}

/** 무기 위치 업데이트 */
function updateWeapon() {
  const weaponOffset = new THREE.Vector3(1, -0.5, -1); // 카메라의 전방으로 이동할 오프셋
    weaponOffset.applyQuaternion(camera.quaternion); // 카메라 회전에 따라 오프셋 조정

    // 카메라의 pitch (상하 회전 각도) 에 따라 무기 위치를 약간 위아래로 조정
    const pitchAdjustment = Math.sin(camera.rotation.x) * 0.2; // 카메라 회전 각도에 따라 y축 이동 값 계산
    weaponOffset.y += pitchAdjustment; // y 오프셋에 상하 움직임 추가

    weapon.position.copy(camera.position).add(weaponOffset); // 무기 위치를 카메라 위치와 오프셋으로 설정
    weapon.rotation.copy(camera.rotation);
}

function createBullet(player) {
  const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8); // 작은 구체로 총알 생성
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // 빨간색 총알
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

  // 총알의 시작 위치는 플레이어의 무기 위치
  bullet.position.copy(player.position);

  // 총알의 이동 방향은 카메라가 바라보는 방향
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  bullet.userData.velocity = direction.multiplyScalar(0.5); // 속도 설정

  scene.add(bullet);
  bullets.push(bullet);

  socket.emit('bulletFired', {
    playerId: socket.id,
    position: bullet.position,
    direction: bullet.userData.velocity,
    roomName: roomId
});
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.position.add(bullet.userData.velocity);
    // checkClientBulletCollision(bullet);
    if (bullet.position.length() > 1000) {
        scene.remove(bullet);
        bullets.splice(i, 1);
    }
}
}


function update() {
  const moveDirection = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
    camera.quaternion
  );
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

  // Calculate movement direction
  if (moveForward)
    moveDirection.add(forward.clone().multiplyScalar(playerSpeed));
  if (moveBackward)
    moveDirection.add(forward.clone().multiplyScalar(-playerSpeed));
  if (moveLeft) moveDirection.add(right.clone().multiplyScalar(-playerSpeed));
  if (moveRight) moveDirection.add(right.clone().multiplyScalar(playerSpeed));

  const newPosition = player.position.clone().add(moveDirection);
  player.updateMatrixWorld();
  const playerBoundingBox = new THREE.Box3()
    .setFromObject(player)
    .translate(moveDirection);

  let collisionDetected = false;
  let verticalCollision = false;
  let onTopOfBuilding = false;

  for (let i = 0; i < buildings.length; i++) {
    const building = buildings[i];
    building.updateMatrixWorld();
    const buildingBoundingBox = new THREE.Box3().setFromObject(building);

    if (playerBoundingBox.intersectsBox(buildingBoundingBox)) {
      collisionDetected = true;

      // Check if collision is from above (player landing on top)
      if (
        player.position.y >= buildingBoundingBox.max.y - 0.01 &&
        jumpVelocity <= 0
      ) {
        player.position.y = buildingBoundingBox.max.y; // Set Y position on top of the building
        isJumping = false; // Stop jumping
        jumpVelocity = 0; // Reset jump velocity
      } else {
        verticalCollision = true;
      }
      break;
    }
  }

  if (!collisionDetected) {
    player.position.copy(newPosition);
  } else if (!verticalCollision) {
    player.position.add(moveDirection);
  }

  // Handle jumping
  if (isJumping) {
    player.position.y += jumpVelocity;
    jumpVelocity -= gravity;

    playerBoundingBox.setFromObject(player);
    playerBoundingBox.min.y = player.position.y;
    playerBoundingBox.max.y = player.position.y + 1;


    if (!onTopOfBuilding) {
      let onBuilding = false;

      for (let i = 0; i < buildings.length; i++) {
        const buildingBoundingBox = new THREE.Box3().setFromObject(
          buildings[i]
        );

        if (
          player.position.y >= buildingBoundingBox.max.y - 0.01 &&
          playerBoundingBox.intersectsBox(buildingBoundingBox)
        ) {
          player.position.y = buildingBoundingBox.max.y; // Land on top of the building
          jumpVelocity = 0;
          isJumping = false;
          onBuilding = true;
          break;
        }
      }

      if (!onBuilding && player.position.y <= floorY + 0.5) {
        player.position.y = floorY + 0.5;
        isJumping = false;
        jumpVelocity = 0;
      }
    }
  } else if (!onTopOfBuilding) {
    // Apply gravity if the player is not on top of any building
    if (player.position.y > floorY + 0.5) {
      isJumping = true;
      jumpVelocity = 0; // Start falling
    } else {
      player.position.y = floorY + 0.5;
    }
  }

  // Ensure player stays within bounds
  if (player.position.x < -100) player.position.x = -100;
  if (player.position.x > 100) player.position.x = 100;
  if (player.position.z < -100) player.position.z = -100;
  if (player.position.z > 100) player.position.z = 100;

  // Align player box rotation with camera direction
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
    camera.quaternion
  );

  player.rotation.copy(camera.rotation + pitchLimit);
  player.rotation.y = Math.atan2(direction.x, direction.z);

  updateWeapon();
  updateBullets();

    for (let id in playersObj) {
        if(id === player.uuid) continue
        const { weapon } = playersObj[id];
        const otherWeaponOffset = new THREE.Vector3(1, -0.5, -1).applyQuaternion(camera.quaternion);

        const pitchAdjustment = Math.sin(camera.rotation.x) * 0.2;
        otherWeaponOffset.y += pitchAdjustment;

        weapon.position.copy(camera.position).add(otherWeaponOffset);
        weapon.rotation.copy(camera.rotation);
    }


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

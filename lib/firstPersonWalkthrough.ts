import * as THREE from "three";

export class FirstPersonWalkthroughController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  public enabled = false;

  // Movement speed
  public moveSpeed = 4.0; // m/s
  public eyeHeight = 1.7; // 1.7m eye level
  public targetElevation = 0;

  // Movement state
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;
  private isRunning = false;

  // Rotation Euler
  private euler = new THREE.Euler(0, 0, 0, "YXZ");
  private isPointerLocked = false;
  private prevTime = performance.now();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
  }

  public activate(startFloorElevationMeters = 0) {
    this.targetElevation = startFloorElevationMeters;
    this.enabled = true;
    this.euler.setFromQuaternion(this.camera.quaternion);

    // Set eye level
    this.camera.position.y = this.targetElevation + this.eyeHeight;

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.domElement.addEventListener("mousemove", this.onMouseMove);

    try {
      this.domElement.requestPointerLock();
    } catch (e) {
      console.warn("Pointer lock request failed", e);
    }
  }

  public deactivate() {
    this.enabled = false;
    this.isPointerLocked = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;

    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.domElement.removeEventListener("mousemove", this.onMouseMove);

    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  private onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.enabled || !this.isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.y -= movementX * 0.002;
    this.euler.x -= movementY * 0.002;

    // Clamp pitch between -85 and +85 degrees
    this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  private onKeyDown(event: KeyboardEvent) {
    if (!this.enabled) return;
    if (["input", "textarea", "select"].includes((event.target as HTMLElement)?.tagName?.toLowerCase())) return;

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.moveForward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        this.moveBackward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.moveLeft = true;
        break;
      case "KeyD":
      case "ArrowRight":
        this.moveRight = true;
        break;
      case "KeyE":
      case "Space":
        this.moveUp = true;
        break;
      case "KeyQ":
        this.moveDown = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.isRunning = true;
        break;
      case "Escape":
        this.deactivate();
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    if (!this.enabled) return;
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.moveForward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        this.moveBackward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.moveLeft = false;
        break;
      case "KeyD":
      case "ArrowRight":
        this.moveRight = false;
        break;
      case "KeyE":
      case "Space":
        this.moveUp = false;
        break;
      case "KeyQ":
        this.moveDown = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.isRunning = false;
        break;
    }
  }

  public update(): void {
    if (!this.enabled) return;

    const time = performance.now();
    const delta = Math.min((time - this.prevTime) / 1000, 0.1);
    this.prevTime = time;

    const speed = this.moveSpeed * (this.isRunning ? 2.5 : 1.0) * delta;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; // keep horizontal walking
    forward.normalize();

    const side = new THREE.Vector3();
    side.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.moveForward) this.camera.position.addScaledVector(forward, speed);
    if (this.moveBackward) this.camera.position.addScaledVector(forward, -speed);
    if (this.moveRight) this.camera.position.addScaledVector(side, speed);
    if (this.moveLeft) this.camera.position.addScaledVector(side, -speed);

    if (this.moveUp) this.camera.position.y += speed * 0.8;
    if (this.moveDown) this.camera.position.y -= speed * 0.8;
  }
}

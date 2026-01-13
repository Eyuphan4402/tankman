import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';
sdk.actions.ready();

// ============== CONSTANTS ==============
const TILE_SIZE = 32;
const GRID_WIDTH = 13;
const GRID_HEIGHT = 13;
const CANVAS_WIDTH = TILE_SIZE * GRID_WIDTH;
const CANVAS_HEIGHT = TILE_SIZE * GRID_HEIGHT;

// Tile Types
const TILE = {
    EMPTY: 0,
    BRICK: 1,
    STEEL: 2,
    WATER: 3,
    TREE: 4,
    BASE: 5
};

// Colors (NES Style)
const COLORS = {
    BG: '#000000',
    BRICK: '#B53120',
    BRICK_DARK: '#6B1C10',
    STEEL: '#ADADAD',
    STEEL_DARK: '#636363',
    WATER: '#0078F8',
    WATER_DARK: '#0058A8',
    TREE: '#00A800',
    TREE_DARK: '#006800',
    BASE: '#FCE094',
    PLAYER: '#FCE094',
    PLAYER_DARK: '#E4A672',
    ENEMY: '#D82800',
    ENEMY_DARK: '#881400',
    BULLET: '#FCFCFC'
};

// ============== GAME STATE ==============
let gameState = 'title'; // title, playing, gameover, victory
let canvas, ctx;
let screenWidth, screenHeight, scale, offsetX, offsetY;

// Player
let player = {
    gridX: 4,
    gridY: 12,
    x: 0,
    y: 0,
    direction: 'up',
    moving: false,
    targetX: 0,
    targetY: 0,
    speed: 3,
    lives: 3,
    canShoot: true,
    shootCooldown: 0
};

// Game objects
let enemies = [];
let bullets = [];
let map = [];
let explosions = [];

// Game stats
let score = 0;
let hiScore = 0;
let level = 1;
let enemiesRemaining = 20;
let enemySpawnTimer = 0;
let enemySpawnDelay = 180;

// Input
let keys = { up: false, down: false, left: false, right: false };

// ============== INITIALIZATION ==============
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    resize();
    window.addEventListener('resize', resize);
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (gameState === 'title') {
            if (e.key === 'Enter' || e.key === ' ') startGame();
            return;
        }
        if (gameState === 'gameover' || gameState === 'victory') {
            if (e.key === 'Enter' || e.key === ' ') { gameState = 'title'; return; }
        }
        if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
        if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
        if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    });
    
    // Touch controls
    setupTouchControls();
    
    gameLoop();
}

function resize() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    
    // Calculate scale to fit canvas
    const gameRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
    const screenRatio = screenWidth / screenHeight;
    
    if (screenRatio > gameRatio) {
        scale = screenHeight / CANVAS_HEIGHT;
    } else {
        scale = screenWidth / CANVAS_WIDTH;
    }
    
    scale = Math.min(scale, 2); // Max 2x scale
    
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    
    offsetX = (screenWidth - CANVAS_WIDTH * scale) / 2;
    offsetY = (screenHeight - CANVAS_HEIGHT * scale) / 2;
}

function setupTouchControls() {
    const btnUp = document.getElementById('btnUp');
    const btnDown = document.getElementById('btnDown');
    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    
    function setupBtn(btn, key) {
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
        btn.addEventListener('mousedown', () => keys[key] = true);
        btn.addEventListener('mouseup', () => keys[key] = false);
        btn.addEventListener('mouseleave', () => keys[key] = false);
    }
    
    setupBtn(btnUp, 'up');
    setupBtn(btnDown, 'down');
    setupBtn(btnLeft, 'left');
    setupBtn(btnRight, 'right');
    
    // Start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (gameState === 'title') startGame();
            else if (gameState === 'gameover' || gameState === 'victory') gameState = 'title';
        });
    }
}

// ============== MAP GENERATION ==============
function generateMap() {
    map = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            map[y][x] = TILE.EMPTY;
        }
    }
    
    // Add base at bottom center
    map[GRID_HEIGHT - 1][Math.floor(GRID_WIDTH / 2)] = TILE.BASE;
    
    // Protect base with bricks
    const baseX = Math.floor(GRID_WIDTH / 2);
    map[GRID_HEIGHT - 2][baseX - 1] = TILE.BRICK;
    map[GRID_HEIGHT - 2][baseX] = TILE.BRICK;
    map[GRID_HEIGHT - 2][baseX + 1] = TILE.BRICK;
    map[GRID_HEIGHT - 1][baseX - 1] = TILE.BRICK;
    map[GRID_HEIGHT - 1][baseX + 1] = TILE.BRICK;
    
    // Generate random obstacles
    const patterns = [
        // Brick clusters
        () => {
            const x = 1 + Math.floor(Math.random() * (GRID_WIDTH - 2));
            const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 5));
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    if (x + dx < GRID_WIDTH && y + dy < GRID_HEIGHT - 2) {
                        map[y + dy][x + dx] = TILE.BRICK;
                    }
                }
            }
        },
        // Steel walls
        () => {
            const x = 1 + Math.floor(Math.random() * (GRID_WIDTH - 2));
            const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 5));
            if (Math.random() < 0.5) {
                for (let dx = 0; dx < 3 && x + dx < GRID_WIDTH; dx++) {
                    map[y][x + dx] = TILE.STEEL;
                }
            } else {
                for (let dy = 0; dy < 3 && y + dy < GRID_HEIGHT - 2; dy++) {
                    map[y + dy][x] = TILE.STEEL;
                }
            }
        },
        // Water
        () => {
            const x = 1 + Math.floor(Math.random() * (GRID_WIDTH - 3));
            const y = 3 + Math.floor(Math.random() * (GRID_HEIGHT - 6));
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    if (map[y + dy][x + dx] === TILE.EMPTY) {
                        map[y + dy][x + dx] = TILE.WATER;
                    }
                }
            }
        },
        // Trees
        () => {
            const x = Math.floor(Math.random() * GRID_WIDTH);
            const y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));
            if (map[y][x] === TILE.EMPTY) {
                map[y][x] = TILE.TREE;
            }
        }
    ];
    
    // Place obstacles
    for (let i = 0; i < 15 + level * 2; i++) {
        patterns[Math.floor(Math.random() * patterns.length)]();
    }
    
    // Clear spawn points
    map[0][0] = TILE.EMPTY;
    map[0][Math.floor(GRID_WIDTH / 2)] = TILE.EMPTY;
    map[0][GRID_WIDTH - 1] = TILE.EMPTY;
    map[GRID_HEIGHT - 1][1] = TILE.EMPTY; // Player spawn area
    map[GRID_HEIGHT - 1][2] = TILE.EMPTY;
    map[GRID_HEIGHT - 2][1] = TILE.EMPTY;
    map[GRID_HEIGHT - 2][2] = TILE.EMPTY;
}

// ============== GAME START ==============
function startGame() {
    gameState = 'playing';
    score = 0;
    level = 1;
    player.lives = 3;
    player.gridX = 4;
    player.gridY = GRID_HEIGHT - 2;
    player.x = player.gridX * TILE_SIZE;
    player.y = player.gridY * TILE_SIZE;
    player.targetX = player.x;
    player.targetY = player.y;
    player.direction = 'up';
    player.moving = false;
    
    enemies = [];
    bullets = [];
    explosions = [];
    enemiesRemaining = 20;
    enemySpawnTimer = 0;
    
    generateMap();
    
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('controls').style.display = 'block';
}

// ============== SPAWNING ==============
function spawnEnemy() {
    if (enemiesRemaining <= 0 || enemies.length >= 4) return;
    
    const spawnPoints = [
        { x: 0, y: 0 },
        { x: Math.floor(GRID_WIDTH / 2), y: 0 },
        { x: GRID_WIDTH - 1, y: 0 }
    ];
    
    const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    
    // Check if spawn point is clear
    for (const e of enemies) {
        if (Math.abs(e.gridX - spawn.x) < 2 && Math.abs(e.gridY - spawn.y) < 2) return;
    }
    
    enemies.push({
        gridX: spawn.x,
        gridY: spawn.y,
        x: spawn.x * TILE_SIZE,
        y: spawn.y * TILE_SIZE,
        targetX: spawn.x * TILE_SIZE,
        targetY: spawn.y * TILE_SIZE,
        direction: 'down',
        moving: false,
        speed: 2 + Math.random(),
        shootCooldown: 60 + Math.random() * 60,
        hp: 1 + Math.floor(level / 3),
        type: Math.floor(Math.random() * 3) // 0: basic, 1: fast, 2: armored
    });
    
    enemiesRemaining--;
}

// ============== UPDATE ==============
function update() {
    if (gameState !== 'playing') return;
    
    updatePlayer();
    updateEnemies();
    updateBullets();
    updateExplosions();
    
    // Spawn enemies
    enemySpawnTimer++;
    if (enemySpawnTimer >= enemySpawnDelay) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }
    
    // Check victory
    if (enemiesRemaining <= 0 && enemies.length === 0) {
        level++;
        if (level > 10) {
            gameState = 'victory';
            document.getElementById('gameover-screen').classList.remove('hidden');
            document.getElementById('gameover-screen').querySelector('h2').textContent = 'VICTORY!';
            document.getElementById('finalWave').textContent = level - 1;
            document.getElementById('finalScore').textContent = score;
        } else {
            enemiesRemaining = 20;
            generateMap();
        }
    }
    
    // Shoot cooldown
    if (player.shootCooldown > 0) player.shootCooldown--;
}

function updatePlayer() {
    // Grid-based movement
    if (!player.moving) {
        let newDir = null;
        if (keys.up) newDir = 'up';
        else if (keys.down) newDir = 'down';
        else if (keys.left) newDir = 'left';
        else if (keys.right) newDir = 'right';
        
        if (newDir) {
            player.direction = newDir;
            
            let nextX = player.gridX;
            let nextY = player.gridY;
            
            if (newDir === 'up') nextY--;
            else if (newDir === 'down') nextY++;
            else if (newDir === 'left') nextX--;
            else if (newDir === 'right') nextX++;
            
            // Check bounds and collision
            if (nextX >= 0 && nextX < GRID_WIDTH && nextY >= 0 && nextY < GRID_HEIGHT) {
                const tile = map[nextY][nextX];
                if (tile === TILE.EMPTY || tile === TILE.TREE) {
                    // Check enemy collision
                    let blocked = false;
                    for (const e of enemies) {
                        if (e.gridX === nextX && e.gridY === nextY) {
                            blocked = true;
                            break;
                        }
                    }
                    
                    if (!blocked) {
                        player.gridX = nextX;
                        player.gridY = nextY;
                        player.targetX = nextX * TILE_SIZE;
                        player.targetY = nextY * TILE_SIZE;
                        player.moving = true;
                    }
                }
            }
            
            // Auto shoot
            if (player.shootCooldown <= 0) {
                shoot(player.x + TILE_SIZE / 2, player.y + TILE_SIZE / 2, player.direction, true);
                player.shootCooldown = 20;
            }
        }
    } else {
        // Move towards target
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        
        if (Math.abs(dx) > player.speed) {
            player.x += Math.sign(dx) * player.speed;
        } else if (Math.abs(dy) > player.speed) {
            player.y += Math.sign(dy) * player.speed;
        } else {
            player.x = player.targetX;
            player.y = player.targetY;
            player.moving = false;
        }
    }
}

function updateEnemies() {
    for (const enemy of enemies) {
        if (!enemy.moving) {
            // Random direction change
            if (Math.random() < 0.02) {
                enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
            }
            
            // Bias towards player/base
            if (Math.random() < 0.1) {
                if (enemy.gridY < GRID_HEIGHT - 2) {
                    enemy.direction = 'down';
                } else if (enemy.gridX < player.gridX) {
                    enemy.direction = 'right';
                } else if (enemy.gridX > player.gridX) {
                    enemy.direction = 'left';
                }
            }
            
            let nextX = enemy.gridX;
            let nextY = enemy.gridY;
            
            if (enemy.direction === 'up') nextY--;
            else if (enemy.direction === 'down') nextY++;
            else if (enemy.direction === 'left') nextX--;
            else if (enemy.direction === 'right') nextX++;
            
            // Check collision
            if (nextX >= 0 && nextX < GRID_WIDTH && nextY >= 0 && nextY < GRID_HEIGHT) {
                const tile = map[nextY][nextX];
                if (tile === TILE.EMPTY || tile === TILE.TREE) {
                    // Check other enemies and player
                    let blocked = false;
                    if (nextX === player.gridX && nextY === player.gridY) blocked = true;
                    for (const e of enemies) {
                        if (e !== enemy && e.gridX === nextX && e.gridY === nextY) {
                            blocked = true;
                            break;
                        }
                    }
                    
                    if (!blocked) {
                        enemy.gridX = nextX;
                        enemy.gridY = nextY;
                        enemy.targetX = nextX * TILE_SIZE;
                        enemy.targetY = nextY * TILE_SIZE;
                        enemy.moving = true;
                    } else {
                        enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
                    }
                } else {
                    enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
                }
            } else {
                enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
            }
            
            // Shoot
            enemy.shootCooldown--;
            if (enemy.shootCooldown <= 0) {
                shoot(enemy.x + TILE_SIZE / 2, enemy.y + TILE_SIZE / 2, enemy.direction, false);
                enemy.shootCooldown = 90 + Math.random() * 60;
            }
        } else {
            // Move towards target
            const dx = enemy.targetX - enemy.x;
            const dy = enemy.targetY - enemy.y;
            
            if (Math.abs(dx) > enemy.speed) {
                enemy.x += Math.sign(dx) * enemy.speed;
            } else if (Math.abs(dy) > enemy.speed) {
                enemy.y += Math.sign(dy) * enemy.speed;
            } else {
                enemy.x = enemy.targetX;
                enemy.y = enemy.targetY;
                enemy.moving = false;
            }
        }
    }
}

function shoot(x, y, direction, isPlayer) {
    let vx = 0, vy = 0;
    const speed = 8;
    
    if (direction === 'up') vy = -speed;
    else if (direction === 'down') vy = speed;
    else if (direction === 'left') vx = -speed;
    else if (direction === 'right') vx = speed;
    
    bullets.push({ x, y, vx, vy, isPlayer });
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        
        // Out of bounds
        if (b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
            bullets.splice(i, 1);
            continue;
        }
        
        // Tile collision
        const tileX = Math.floor(b.x / TILE_SIZE);
        const tileY = Math.floor(b.y / TILE_SIZE);
        
        if (tileX >= 0 && tileX < GRID_WIDTH && tileY >= 0 && tileY < GRID_HEIGHT) {
            const tile = map[tileY][tileX];
            
            if (tile === TILE.BRICK) {
                map[tileY][tileX] = TILE.EMPTY;
                createExplosion(tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2, 'small');
                bullets.splice(i, 1);
                continue;
            }
            
            if (tile === TILE.STEEL) {
                createExplosion(b.x, b.y, 'tiny');
                bullets.splice(i, 1);
                continue;
            }
            
            if (tile === TILE.BASE) {
                createExplosion(tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2, 'big');
                gameState = 'gameover';
                document.getElementById('gameover-screen').classList.remove('hidden');
                document.getElementById('gameover-screen').querySelector('h2').textContent = 'GAME OVER';
                document.getElementById('finalWave').textContent = level;
                document.getElementById('finalScore').textContent = score;
                return;
            }
        }
        
        // Player hit by enemy bullet
        if (!b.isPlayer) {
            if (b.x > player.x && b.x < player.x + TILE_SIZE &&
                b.y > player.y && b.y < player.y + TILE_SIZE) {
                player.lives--;
                createExplosion(player.x + TILE_SIZE / 2, player.y + TILE_SIZE / 2, 'big');
                bullets.splice(i, 1);
                
                if (player.lives <= 0) {
                    gameState = 'gameover';
                    document.getElementById('gameover-screen').classList.remove('hidden');
                    document.getElementById('gameover-screen').querySelector('h2').textContent = 'GAME OVER';
                    document.getElementById('finalWave').textContent = level;
                    document.getElementById('finalScore').textContent = score;
                } else {
                    // Respawn player
                    player.gridX = 4;
                    player.gridY = GRID_HEIGHT - 2;
                    player.x = player.gridX * TILE_SIZE;
                    player.y = player.gridY * TILE_SIZE;
                    player.targetX = player.x;
                    player.targetY = player.y;
                    player.moving = false;
                }
                continue;
            }
        }
        
        // Enemy hit by player bullet
        if (b.isPlayer) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (b.x > e.x && b.x < e.x + TILE_SIZE &&
                    b.y > e.y && b.y < e.y + TILE_SIZE) {
                    e.hp--;
                    bullets.splice(i, 1);
                    
                    if (e.hp <= 0) {
                        createExplosion(e.x + TILE_SIZE / 2, e.y + TILE_SIZE / 2, 'big');
                        enemies.splice(j, 1);
                        score += 100;
                        if (score > hiScore) hiScore = score;
                    } else {
                        createExplosion(e.x + TILE_SIZE / 2, e.y + TILE_SIZE / 2, 'small');
                    }
                    break;
                }
            }
        }
        
        // Bullet vs bullet
        for (let j = i - 1; j >= 0; j--) {
            const b2 = bullets[j];
            if (b.isPlayer !== b2.isPlayer) {
                if (Math.abs(b.x - b2.x) < 8 && Math.abs(b.y - b2.y) < 8) {
                    createExplosion(b.x, b.y, 'tiny');
                    bullets.splice(i, 1);
                    bullets.splice(j, 1);
                    i--;
                    break;
                }
            }
        }
    }
}

function createExplosion(x, y, size) {
    explosions.push({ x, y, size, frame: 0 });
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].frame++;
        if (explosions[i].frame > 15) {
            explosions.splice(i, 1);
        }
    }
}

// ============== DRAWING ==============
function draw() {
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    if (gameState === 'title') {
        drawTitle();
    } else if (gameState === 'playing' || gameState === 'gameover' || gameState === 'victory') {
        drawGame();
        drawHUD();
    }
    
    ctx.restore();
}

function drawTitle() {
    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Title
    ctx.fillStyle = COLORS.PLAYER;
    ctx.font = 'bold 36px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('BASE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
    ctx.fillText('CITY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    
    // Subtitle
    ctx.fillStyle = '#888';
    ctx.font = '14px "Courier New"';
    ctx.fillText('PRESS START', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
    
    // Tank icon
    drawTank(CANVAS_WIDTH / 2 - TILE_SIZE / 2, CANVAS_HEIGHT / 2 + 100, 'up', true);
}

function drawGame() {
    // Draw map
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const tile = map[y][x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            
            if (tile === TILE.BRICK) {
                drawBrick(px, py);
            } else if (tile === TILE.STEEL) {
                drawSteel(px, py);
            } else if (tile === TILE.WATER) {
                drawWater(px, py);
            } else if (tile === TILE.BASE) {
                drawBase(px, py);
            }
        }
    }
    
    // Draw bullets (under trees)
    for (const b of bullets) {
        ctx.fillStyle = b.isPlayer ? COLORS.BULLET : COLORS.ENEMY;
        ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
    }
    
    // Draw player
    drawTank(player.x, player.y, player.direction, true);
    
    // Draw enemies
    for (const e of enemies) {
        drawTank(e.x, e.y, e.direction, false, e.type);
    }
    
    // Draw trees (on top)
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            if (map[y][x] === TILE.TREE) {
                drawTree(x * TILE_SIZE, y * TILE_SIZE);
            }
        }
    }
    
    // Draw explosions
    for (const exp of explosions) {
        const maxRadius = exp.size === 'big' ? 24 : exp.size === 'small' ? 16 : 8;
        const progress = exp.frame / 15;
        const radius = maxRadius * (1 - Math.abs(progress - 0.5) * 2);
        
        ctx.fillStyle = `rgba(255, ${Math.floor(200 - progress * 200)}, 0, ${1 - progress})`;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawTank(x, y, direction, isPlayer, type = 0) {
    ctx.save();
    ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    
    let angle = 0;
    if (direction === 'down') angle = Math.PI;
    else if (direction === 'left') angle = -Math.PI / 2;
    else if (direction === 'right') angle = Math.PI / 2;
    ctx.rotate(angle);
    
    const size = TILE_SIZE - 4;
    const half = size / 2;
    
    // Tank body
    if (isPlayer) {
        ctx.fillStyle = COLORS.PLAYER;
    } else {
        ctx.fillStyle = type === 2 ? '#888' : type === 1 ? '#8B4513' : COLORS.ENEMY;
    }
    ctx.fillRect(-half + 4, -half, size - 8, size);
    
    // Tracks
    ctx.fillStyle = isPlayer ? COLORS.PLAYER_DARK : (type === 2 ? '#555' : COLORS.ENEMY_DARK);
    ctx.fillRect(-half, -half, 6, size);
    ctx.fillRect(half - 6, -half, 6, size);
    
    // Track details
    ctx.fillStyle = '#333';
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(-half, -half + 4 + i * 8, 6, 2);
        ctx.fillRect(half - 6, -half + 4 + i * 8, 6, 2);
    }
    
    // Turret
    ctx.fillStyle = isPlayer ? COLORS.PLAYER : (type === 2 ? '#aaa' : COLORS.ENEMY);
    ctx.fillRect(-4, -half - 8, 8, 14);
    
    ctx.restore();
}

function drawBrick(x, y) {
    ctx.fillStyle = COLORS.BRICK;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    
    // Brick pattern
    ctx.fillStyle = COLORS.BRICK_DARK;
    for (let row = 0; row < 4; row++) {
        const offset = (row % 2) * 8;
        for (let col = 0; col < 4; col++) {
            ctx.fillRect(x + offset + col * 16 - 8, y + row * 8, 1, 8);
            ctx.fillRect(x + col * 8, y + row * 8, 8, 1);
        }
    }
}

function drawSteel(x, y) {
    ctx.fillStyle = COLORS.STEEL;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    
    ctx.fillStyle = COLORS.STEEL_DARK;
    ctx.fillRect(x, y, TILE_SIZE, 2);
    ctx.fillRect(x, y, 2, TILE_SIZE);
    
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 4, y + 4, 8, 8);
    ctx.fillRect(x + 20, y + 4, 8, 8);
    ctx.fillRect(x + 4, y + 20, 8, 8);
    ctx.fillRect(x + 20, y + 20, 8, 8);
}

function drawWater(x, y) {
    ctx.fillStyle = COLORS.WATER;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    
    ctx.fillStyle = COLORS.WATER_DARK;
    const wave = Math.sin(Date.now() / 200 + x) * 2;
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(x, y + 4 + i * 8 + wave, TILE_SIZE, 2);
    }
}

function drawTree(x, y) {
    ctx.fillStyle = COLORS.TREE;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    
    ctx.fillStyle = COLORS.TREE_DARK;
    for (let i = 0; i < 16; i++) {
        const tx = x + (i % 4) * 8 + Math.random() * 4;
        const ty = y + Math.floor(i / 4) * 8 + Math.random() * 4;
        ctx.fillRect(tx, ty, 4, 4);
    }
}

function drawBase(x, y) {
    ctx.fillStyle = COLORS.BASE;
    ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    
    // Eagle/Flag icon
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 12, y + 8, 8, 16);
    ctx.fillStyle = COLORS.ENEMY;
    ctx.fillRect(x + 14, y + 10, 10, 6);
}

function drawHUD() {
    // Semi-transparent HUD background on right
    const hudX = CANVAS_WIDTH - 60;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(hudX - 10, 0, 70, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px "Courier New"';
    ctx.textAlign = 'center';
    
    // Enemy icons
    ctx.fillText('ENEMY', hudX + 15, 20);
    ctx.fillStyle = COLORS.ENEMY;
    for (let i = 0; i < enemiesRemaining + enemies.length; i++) {
        const ex = hudX + (i % 2) * 16;
        const ey = 30 + Math.floor(i / 2) * 12;
        ctx.fillRect(ex, ey, 12, 10);
    }
    
    // Lives
    ctx.fillStyle = '#fff';
    ctx.fillText('IP', hudX + 15, 180);
    ctx.fillStyle = COLORS.PLAYER;
    ctx.font = '16px "Courier New"';
    ctx.fillText(player.lives, hudX + 15, 200);
    
    // Level
    ctx.fillStyle = '#fff';
    ctx.font = '10px "Courier New"';
    ctx.fillText('STAGE', hudX + 15, 240);
    ctx.fillStyle = '#F80';
    ctx.font = '16px "Courier New"';
    ctx.fillText(level, hudX + 15, 260);
    
    // Score at top
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score, 10, 20);
}

// ============== GAME LOOP ==============
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
init();

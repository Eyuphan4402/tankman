import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// Initialize Farcaster SDK
sdk.actions.ready();

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'menu';
let score = 0;
let wave = 1;
let xp = 0;

// Player Tank
let player = {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    speed: 4,
    hp: 3,
    maxHp: 3,
    bulletSpeed: 10,
    fireRate: 400,
    lastFire: 0,
    ricochet: 0,
    isMoving: false,
    direction: 'up' // up, down, left, right
};

// Base
let base = {
    hp: 5,
    maxHp: 5
};

// Game Objects
let bullets = [];
let enemies = [];
let enemyBullets = [];
let walls = [];
let explosions = [];
let turrets = [];
let mines = [];
let barrels = [];

// Button Control
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;

// Screen dimensions
let screenWidth, screenHeight;

// Resize handler
function resize() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    
    // Reset player position
    if (gameState === 'menu') {
        player.x = screenWidth / 2;
        player.y = screenHeight - 150;
    }
}

window.addEventListener('resize', resize);
resize();

// Initialize player position
player.x = screenWidth / 2;
player.y = screenHeight - 150;

// Button Controls
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');

function setupButton(btn, direction) {
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (direction === 'left') moveLeft = true;
        if (direction === 'right') moveRight = true;
        if (direction === 'up') moveUp = true;
        if (direction === 'down') moveDown = true;
        player.isMoving = true;
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (direction === 'left') moveLeft = false;
        if (direction === 'right') moveRight = false;
        if (direction === 'up') moveUp = false;
        if (direction === 'down') moveDown = false;
        if (!moveLeft && !moveRight && !moveUp && !moveDown) {
            player.isMoving = false;
        }
    });
    btn.addEventListener('mousedown', () => {
        if (direction === 'left') moveLeft = true;
        if (direction === 'right') moveRight = true;
        if (direction === 'up') moveUp = true;
        if (direction === 'down') moveDown = true;
        player.isMoving = true;
    });
    btn.addEventListener('mouseup', () => {
        if (direction === 'left') moveLeft = false;
        if (direction === 'right') moveRight = false;
        if (direction === 'up') moveUp = false;
        if (direction === 'down') moveDown = false;
        if (!moveLeft && !moveRight && !moveUp && !moveDown) {
            player.isMoving = false;
        }
    });
    btn.addEventListener('mouseleave', () => {
        if (direction === 'left') moveLeft = false;
        if (direction === 'right') moveRight = false;
        if (direction === 'up') moveUp = false;
        if (direction === 'down') moveDown = false;
        if (!moveLeft && !moveRight && !moveUp && !moveDown) {
            player.isMoving = false;
        }
    });
}

setupButton(btnLeft, 'left');
setupButton(btnRight, 'right');
setupButton(btnUp, 'up');
setupButton(btnDown, 'down');

// Keyboard controls for desktop
document.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { moveLeft = true; player.isMoving = true; }
    if (e.key === 'ArrowRight' || e.key === 'd') { moveRight = true; player.isMoving = true; }
    if (e.key === 'ArrowUp' || e.key === 'w') { moveUp = true; player.isMoving = true; }
    if (e.key === 'ArrowDown' || e.key === 's') { moveDown = true; player.isMoving = true; }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') moveLeft = false;
    if (e.key === 'ArrowRight' || e.key === 'd') moveRight = false;
    if (e.key === 'ArrowUp' || e.key === 'w') moveUp = false;
    if (e.key === 'ArrowDown' || e.key === 's') moveDown = false;
    if (!moveLeft && !moveRight && !moveUp && !moveDown) {
        player.isMoving = false;
    }
});

// Find nearest enemy
function findNearestEnemy() {
    let nearest = null;
    let minDist = Infinity;
    
    const allTargets = [...enemies, ...turrets];
    
    for (const target of allTargets) {
        const dist = Math.hypot(target.x - player.x, target.y - player.y);
        if (dist < minDist) {
            minDist = dist;
            nearest = target;
        }
    }
    
    return nearest;
}

// Fire bullet in player's direction
function fireBullet() {
    const now = Date.now();
    if (now - player.lastFire < player.fireRate) return;
    
    let vx = 0, vy = 0;
    let bx = player.x, by = player.y;
    
    switch (player.direction) {
        case 'up':
            vy = -player.bulletSpeed;
            by = player.y - player.height / 2;
            break;
        case 'down':
            vy = player.bulletSpeed;
            by = player.y + player.height / 2;
            break;
        case 'left':
            vx = -player.bulletSpeed;
            bx = player.x - player.width / 2;
            break;
        case 'right':
            vx = player.bulletSpeed;
            bx = player.x + player.width / 2;
            break;
    }
    
    bullets.push({
        x: bx,
        y: by,
        vx: vx,
        vy: vy,
        ricochet: player.ricochet
    });
    
    player.lastFire = now;
}

// Spawn wave enemies
function spawnWave() {
    const enemyCount = 3 + wave * 2;
    const rows = Math.ceil(enemyCount / 4);
    
    for (let row = 0; row < rows; row++) {
        const enemiesInRow = Math.min(4, enemyCount - row * 4);
        const spacing = screenWidth / (enemiesInRow + 1);
        
        for (let i = 0; i < enemiesInRow; i++) {
            enemies.push({
                x: spacing * (i + 1),
                y: -50 - row * 80,
                width: 35,
                height: 35,
                hp: 1 + Math.floor(wave / 3),
                speed: 1 + wave * 0.15,
                fireRate: 2500 - Math.min(wave * 100, 1500),
                lastFire: Date.now() + Math.random() * 2000,
                direction: 'down',
                moveTimer: 0,
                moveDelay: 60 + Math.random() * 60
            });
        }
    }
    
    // Add turrets after wave 3
    if (wave >= 3) {
        const turretCount = Math.floor(wave / 3);
        for (let i = 0; i < turretCount; i++) {
            turrets.push({
                x: 50 + Math.random() * (screenWidth - 100),
                y: 100 + Math.random() * 200,
                width: 40,
                height: 40,
                hp: 2,
                fireRate: 2000,
                lastFire: Date.now(),
                direction: 'down'
            });
        }
    }
    
    // Add mines after wave 5
    if (wave >= 5) {
        const mineCount = Math.floor((wave - 4) / 2);
        for (let i = 0; i < mineCount; i++) {
            mines.push({
                x: 50 + Math.random() * (screenWidth - 100),
                y: 150 + Math.random() * (screenHeight / 2),
                radius: 15,
                speed: 1 + Math.random(),
                angle: Math.random() * Math.PI * 2
            });
        }
    }
    
    // Spawn walls
    spawnWalls();
}

// Spawn walls
function spawnWalls() {
    walls = [];
    barrels = [];
    
    const wallCount = 3 + wave;
    
    for (let i = 0; i < wallCount; i++) {
        const isSteelWall = Math.random() < 0.3 && wave >= 2;
        walls.push({
            x: 30 + Math.random() * (screenWidth - 60),
            y: 200 + Math.random() * (screenHeight / 2 - 100),
            width: 50,
            height: 20,
            hp: isSteelWall ? -1 : 3, // -1 means indestructible
            isSteel: isSteelWall
        });
    }
    
    // Add barrels near steel walls
    const steelWalls = walls.filter(w => w.isSteel);
    for (const wall of steelWalls) {
        if (Math.random() < 0.7) {
            barrels.push({
                x: wall.x + (Math.random() > 0.5 ? 60 : -30),
                y: wall.y,
                radius: 15
            });
        }
    }
}

// Create explosion
function createExplosion(x, y, radius = 50) {
    explosions.push({
        x, y,
        radius: 0,
        maxRadius: radius,
        alpha: 1
    });
    
    // Damage nearby steel walls
    for (const wall of walls) {
        if (wall.isSteel) {
            const dist = Math.hypot(wall.x - x, wall.y - y);
            if (dist < radius + 30) {
                wall.hp = 1; // Make destructible
                wall.isSteel = false;
            }
        }
    }
    
    // Damage nearby enemies
    for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - x, enemy.y - y);
        if (dist < radius) {
            enemy.hp -= 2;
        }
    }
}

// Update game
function update() {
    if (gameState !== 'playing') return;
    
    // Move player based on buttons (one direction at a time)
    if (moveUp) {
        player.y -= player.speed;
        player.direction = 'up';
    } else if (moveDown) {
        player.y += player.speed;
        player.direction = 'down';
    } else if (moveLeft) {
        player.x -= player.speed;
        player.direction = 'left';
    } else if (moveRight) {
        player.x += player.speed;
        player.direction = 'right';
    }
    
    // Clamp player position
    player.x = Math.max(player.width / 2, Math.min(screenWidth - player.width / 2, player.x));
    player.y = Math.max(100, Math.min(screenHeight - 100, player.y));
    
    // Auto-fire continuously
    fireBullet();
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        
        // Check wall collision
        let hitWall = false;
        for (let j = walls.length - 1; j >= 0; j--) {
            const w = walls[j];
            if (b.x > w.x - w.width / 2 && b.x < w.x + w.width / 2 &&
                b.y > w.y - w.height / 2 && b.y < w.y + w.height / 2) {
                
                if (!w.isSteel) {
                    w.hp--;
                    if (w.hp <= 0) {
                        walls.splice(j, 1);
                    }
                }
                
                if (b.ricochet > 0) {
                    b.vy *= -1;
                    b.ricochet--;
                } else {
                    hitWall = true;
                }
                break;
            }
        }
        
        // Check barrel collision
        for (let j = barrels.length - 1; j >= 0; j--) {
            const barrel = barrels[j];
            const dist = Math.hypot(b.x - barrel.x, b.y - barrel.y);
            if (dist < barrel.radius) {
                createExplosion(barrel.x, barrel.y, 80);
                barrels.splice(j, 1);
                hitWall = true;
                break;
            }
        }
        
        // Check enemy collision
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (b.x > e.x - e.width / 2 && b.x < e.x + e.width / 2 &&
                b.y > e.y - e.height / 2 && b.y < e.y + e.height / 2) {
                e.hp--;
                if (e.hp <= 0) {
                    enemies.splice(j, 1);
                    score += 100;
                    xp += 10;
                }
                hitWall = true;
                break;
            }
        }
        
        // Check turret collision
        for (let j = turrets.length - 1; j >= 0; j--) {
            const t = turrets[j];
            if (b.x > t.x - t.width / 2 && b.x < t.x + t.width / 2 &&
                b.y > t.y - t.height / 2 && b.y < t.y + t.height / 2) {
                t.hp--;
                if (t.hp <= 0) {
                    turrets.splice(j, 1);
                    score += 200;
                    xp += 20;
                }
                hitWall = true;
                break;
            }
        }
        
        // Remove bullet if hit or out of bounds
        if (hitWall || b.x < 0 || b.x > screenWidth || b.y < 0 || b.y > screenHeight) {
            bullets.splice(i, 1);
        }
    }
    
    // Update enemies
    for (const enemy of enemies) {
        enemy.moveTimer++;
        
        // Change direction periodically
        if (enemy.moveTimer > enemy.moveDelay) {
            enemy.moveTimer = 0;
            enemy.moveDelay = 60 + Math.random() * 60;
            
            // Choose new direction (weighted towards down and towards player)
            const rand = Math.random();
            if (rand < 0.4) {
                enemy.direction = 'down';
            } else if (rand < 0.6) {
                enemy.direction = player.x < enemy.x ? 'left' : 'right';
            } else if (rand < 0.8) {
                enemy.direction = player.x < enemy.x ? 'left' : 'right';
            } else {
                enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
            }
        }
        
        // Move in current direction
        switch (enemy.direction) {
            case 'up':
                enemy.y -= enemy.speed;
                break;
            case 'down':
                enemy.y += enemy.speed;
                break;
            case 'left':
                enemy.x -= enemy.speed;
                break;
            case 'right':
                enemy.x += enemy.speed;
                break;
        }
        
        // Keep enemy in bounds
        if (enemy.x < enemy.width / 2) { enemy.x = enemy.width / 2; enemy.direction = 'right'; }
        if (enemy.x > screenWidth - enemy.width / 2) { enemy.x = screenWidth - enemy.width / 2; enemy.direction = 'left'; }
        if (enemy.y < 50) { enemy.y = 50; enemy.direction = 'down'; }
        if (enemy.y > screenHeight - 120) { enemy.y = screenHeight - 120; enemy.direction = 'up'; }
        
        // Enemy fire in their direction
        const now = Date.now();
        if (now - enemy.lastFire > enemy.fireRate) {
            let vx = 0, vy = 0;
            let bx = enemy.x, by = enemy.y;
            
            switch (enemy.direction) {
                case 'up':
                    vy = -6;
                    by = enemy.y - enemy.height / 2;
                    break;
                case 'down':
                    vy = 6;
                    by = enemy.y + enemy.height / 2;
                    break;
                case 'left':
                    vx = -6;
                    bx = enemy.x - enemy.width / 2;
                    break;
                case 'right':
                    vx = 6;
                    bx = enemy.x + enemy.width / 2;
                    break;
            }
            
            enemyBullets.push({ x: bx, y: by, vx: vx, vy: vy });
            enemy.lastFire = now;
        }
        
        // Check if enemy reached base
        if (enemy.y > screenHeight - 80) {
            base.hp--;
            enemy.hp = 0;
        }
    }
    
    // Remove dead enemies
    enemies = enemies.filter(e => e.hp > 0);
    
    // Update turrets (fire in 4 directions towards player)
    for (const turret of turrets) {
        const now = Date.now();
        if (now - turret.lastFire > turret.fireRate) {
            let vx = 0, vy = 0;
            const dx = player.x - turret.x;
            const dy = player.y - turret.y;
            
            // Fire in the dominant direction
            if (Math.abs(dx) > Math.abs(dy)) {
                vx = dx > 0 ? 5 : -5;
                turret.direction = dx > 0 ? 'right' : 'left';
            } else {
                vy = dy > 0 ? 5 : -5;
                turret.direction = dy > 0 ? 'down' : 'up';
            }
            
            enemyBullets.push({
                x: turret.x,
                y: turret.y,
                vx: vx,
                vy: vy
            });
            turret.lastFire = now;
        }
    }
    
    // Update mines
    for (const mine of mines) {
        mine.x += Math.cos(mine.angle) * mine.speed;
        mine.y += Math.sin(mine.angle) * mine.speed;
        
        // Bounce off walls
        if (mine.x < mine.radius || mine.x > screenWidth - mine.radius) {
            mine.angle = Math.PI - mine.angle;
        }
        if (mine.y < mine.radius || mine.y > screenHeight - mine.radius) {
            mine.angle = -mine.angle;
        }
        
        // Check player collision
        const dist = Math.hypot(mine.x - player.x, mine.y - player.y);
        if (dist < mine.radius + player.width / 2) {
            player.hp--;
            createExplosion(mine.x, mine.y, 40);
            mine.radius = 0; // Mark for removal
        }
    }
    
    mines = mines.filter(m => m.radius > 0);
    
    // Update enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;
        
        // Check player collision
        if (b.x > player.x - player.width / 2 && b.x < player.x + player.width / 2 &&
            b.y > player.y - player.height / 2 && b.y < player.y + player.height / 2) {
            player.hp--;
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // Check base collision (small target in center)
        const baseX = screenWidth / 2;
        const baseY = screenHeight - 40;
        const baseSize = 40;
        if (b.x > baseX - baseSize / 2 && b.x < baseX + baseSize / 2 &&
            b.y > baseY - baseSize / 2 && b.y < baseY + baseSize / 2) {
            base.hp--;
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // Remove if out of bounds
        if (b.x < 0 || b.x > screenWidth || b.y < 0 || b.y > screenHeight) {
            enemyBullets.splice(i, 1);
        }
    }
    
    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i];
        e.radius += 3;
        e.alpha -= 0.05;
        
        if (e.alpha <= 0) {
            explosions.splice(i, 1);
        }
    }
    
    // Update HUD
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('waveDisplay').textContent = `Wave ${wave}`;
    document.getElementById('baseHealthFill').style.width = `${(base.hp / base.maxHp) * 100}%`;
    document.getElementById('playerHealthFill').style.width = `${(player.hp / player.maxHp) * 100}%`;
    
    // Check game over
    if (player.hp <= 0 || base.hp <= 0) {
        gameOver();
        return;
    }
    
    // Check wave complete
    if (enemies.length === 0 && turrets.length === 0) {
        showUpgradeScreen();
    }
}

// Draw game
function draw() {
    ctx.clearRect(0, 0, screenWidth, screenHeight);
    
    // Draw grid background
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < screenWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, screenHeight);
        ctx.stroke();
    }
    for (let y = 0; y < screenHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(screenWidth, y);
        ctx.stroke();
    }
    
    // Draw base (small building in center)
    const baseX = screenWidth / 2;
    const baseY = screenHeight - 40;
    const baseSize = 40;
    
    // Base platform
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(baseX - 60, screenHeight - 20, 120, 20);
    
    // Base building
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(baseX - baseSize / 2, baseY - baseSize / 2, baseSize, baseSize);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(baseX - baseSize / 2, baseY - baseSize / 2, baseSize, baseSize);
    
    // Base icon
    ctx.fillStyle = '#0a0a0a';
    ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('⬟', baseX, baseY + 4);
    
    // Draw walls
    for (const wall of walls) {
        if (wall.isSteel) {
            ctx.fillStyle = '#64748b';
            ctx.strokeStyle = '#94a3b8';
        } else {
            ctx.fillStyle = '#92400e';
            ctx.strokeStyle = '#b45309';
        }
        ctx.fillRect(wall.x - wall.width / 2, wall.y - wall.height / 2, wall.width, wall.height);
        ctx.strokeRect(wall.x - wall.width / 2, wall.y - wall.height / 2, wall.width, wall.height);
    }
    
    // Draw barrels
    for (const barrel of barrels) {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(barrel.x, barrel.y, barrel.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('!', barrel.x, barrel.y + 4);
    }
    
    // Draw enemies
    for (const enemy of enemies) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        
        // Rotate based on direction
        let angle = 0;
        switch (enemy.direction) {
            case 'up': angle = 0; break;
            case 'down': angle = Math.PI; break;
            case 'left': angle = -Math.PI / 2; break;
            case 'right': angle = Math.PI / 2; break;
        }
        ctx.rotate(angle);
        
        // Tank body
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
        
        // Tank turret (pointing forward)
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(-4, -enemy.height / 2 - 10, 8, 15);
        
        // Tank tracks
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(-enemy.width / 2 - 3, -enemy.height / 2, 6, enemy.height);
        ctx.fillRect(enemy.width / 2 - 3, -enemy.height / 2, 6, enemy.height);
        
        ctx.restore();
        
        // HP indicator
        if (enemy.hp > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(enemy.hp, enemy.x, enemy.y + 4);
        }
    }
    
    // Draw turrets
    for (const turret of turrets) {
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, turret.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Turret gun (4 directions)
        let gx = 0, gy = 0;
        switch (turret.direction) {
            case 'up': gy = -25; break;
            case 'down': gy = 25; break;
            case 'left': gx = -25; break;
            case 'right': gx = 25; break;
        }
        ctx.strokeStyle = '#5b21b6';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(turret.x, turret.y);
        ctx.lineTo(turret.x + gx, turret.y + gy);
        ctx.stroke();
    }
    
    // Draw mines
    for (const mine of mines) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Spikes
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(mine.x, mine.y);
            ctx.lineTo(mine.x + Math.cos(angle) * (mine.radius + 5), mine.y + Math.sin(angle) * (mine.radius + 5));
            ctx.stroke();
        }
    }
    
    // Draw player tank
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Rotate based on direction
    let playerAngle = 0;
    switch (player.direction) {
        case 'up': playerAngle = 0; break;
        case 'down': playerAngle = Math.PI; break;
        case 'left': playerAngle = -Math.PI / 2; break;
        case 'right': playerAngle = Math.PI / 2; break;
    }
    ctx.rotate(playerAngle);
    
    // Tank body
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    // Tank turret (pointing forward)
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-4, -player.height / 2 - 12, 8, 16);
    
    // Tank tracks
    ctx.fillStyle = '#166534';
    ctx.fillRect(-player.width / 2 - 4, -player.height / 2, 6, player.height);
    ctx.fillRect(player.width / 2 - 2, -player.height / 2, 6, player.height);
    
    ctx.restore();
    
    // Draw bullets
    ctx.fillStyle = '#fbbf24';
    for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw enemy bullets
    ctx.fillStyle = '#ef4444';
    for (const b of enemyBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw explosions
    for (const e of explosions) {
        const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
        gradient.addColorStop(0, `rgba(251, 191, 36, ${e.alpha})`);
        gradient.addColorStop(0.5, `rgba(239, 68, 68, ${e.alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(239, 68, 68, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    gameState = 'playing';
    score = 0;
    wave = 1;
    xp = 0;
    
    player.x = screenWidth / 2;
    player.y = screenHeight - 150;
    player.hp = player.maxHp;
    player.bulletSpeed = 8;
    player.ricochet = 0;
    
    base.hp = base.maxHp;
    
    bullets = [];
    enemies = [];
    enemyBullets = [];
    walls = [];
    turrets = [];
    mines = [];
    barrels = [];
    explosions = [];
    
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('upgrade-screen').classList.add('hidden');
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('player-health').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    
    moveLeft = false;
    moveRight = false;
    moveUp = false;
    moveDown = false;
    
    spawnWave();
}

// Show upgrade screen
function showUpgradeScreen() {
    gameState = 'upgrade';
    document.getElementById('upgrade-screen').classList.remove('hidden');
    document.getElementById('xpDisplay').textContent = xp;
}

// Apply upgrade
function applyUpgrade(type) {
    switch (type) {
        case 'bulletSpeed':
            player.bulletSpeed *= 1.25;
            player.fireRate = Math.max(200, player.fireRate - 50);
            break;
        case 'armor':
            player.maxHp++;
            player.hp = player.maxHp;
            break;
        case 'ricochet':
            player.ricochet++;
            break;
    }
    
    wave++;
    xp = 0;
    
    // Clear all projectiles and reset player position
    bullets = [];
    enemyBullets = [];
    mines = [];
    explosions = [];
    
    // Reset player to safe position
    player.x = screenWidth / 2;
    player.y = screenHeight - 150;
    
    document.getElementById('upgrade-screen').classList.add('hidden');
    gameState = 'playing';
    spawnWave();
}

// Game over
function gameOver() {
    gameState = 'gameover';
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('finalWave').textContent = wave;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('player-health').style.display = 'none';
    document.getElementById('controls').style.display = 'none';
}

// Event listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

document.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        applyUpgrade(btn.dataset.upgrade);
    });
});

// Hide HUD initially
document.getElementById('hud').style.display = 'none';
document.getElementById('player-health').style.display = 'none';

// Start game loop
gameLoop();


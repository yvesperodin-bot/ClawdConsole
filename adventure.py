#!/usr/bin/env python3
"""
Adventure - Atari 2600 (1980) Remake
Faithful recreation of Warren Robinett's classic game.
Run: python adventure.py
"""

import pygame
import sys
import math
import random

# --- Constants ---
SCREEN_W, SCREEN_H = 800, 600
ROOM_W, ROOM_H = 800, 520   # playfield
HUD_H = 80
FPS = 60

TILE = 40  # grid unit

# Colors
BLACK   = (0, 0, 0)
WHITE   = (255, 255, 255)
YELLOW  = (255, 220, 0)
GREEN   = (0, 200, 50)
RED     = (220, 30, 30)
BLUE    = (30, 80, 220)
CYAN    = (0, 220, 220)
MAGENTA = (180, 0, 180)
ORANGE  = (255, 140, 0)
GRAY    = (120, 120, 120)
DARK_GRAY = (40, 40, 40)
PURPLE  = (100, 0, 160)
BROWN   = (140, 80, 30)
TEAL    = (0, 160, 140)
LIME    = (120, 220, 0)

# Room background colors
ROOM_COLORS = {
    'golden_castle':    (60, 50, 0),
    'golden_foyer':     (80, 60, 0),
    'white_castle':     (30, 30, 60),
    'white_foyer':      (20, 40, 80),
    'black_castle':     (10, 10, 10),
    'black_foyer':      (20, 10, 20),
    'overworld':        (0, 0, 100),
    'overworld_east':   (0, 20, 80),
    'overworld_west':   (0, 0, 120),
    'overworld_south':  (0, 40, 60),
    'catacomb1':        (40, 0, 0),
    'catacomb2':        (50, 10, 0),
    'catacomb3':        (30, 0, 20),
    'maze1':            (0, 60, 0),
    'maze2':            (0, 40, 20),
    'maze3':            (0, 50, 10),
    'blue_maze1':       (0, 0, 60),
    'blue_maze2':       (10, 0, 80),
    'blue_maze3':       (0, 0, 100),
    'easter_egg_room':  (40, 0, 40),
    'valley':           (0, 80, 0),
    'secret_passage':   (20, 20, 0),
}

# Passage directions
NORTH, SOUTH, EAST, WEST = 'north', 'south', 'east', 'west'

# Wall thickness
WALL = 20

# Player size
PLAYER_SIZE = 24

# --- Room Data ---
# Each room: name, exits {direction: room_id}, walls (pygame.Rect list relative to room), gate info
# Walls are in room-space coords (0,0 = top-left of playfield)

def make_wall(x, y, w, h):
    return pygame.Rect(x, y, w, h)

# Border walls are always present (edges of screen minus passage gaps)
# Passage gap is 80px wide, centered on that edge

GAP = 80  # passage width
GAP_CENTER_X = ROOM_W // 2
GAP_CENTER_Y = ROOM_H // 2

def border_walls(exits):
    """Return border wall rects given which sides have passages."""
    walls = []
    # Top
    if NORTH in exits:
        cx = exits[NORTH].get('offset', GAP_CENTER_X)
        walls.append(make_wall(0, 0, cx - GAP//2, WALL))
        walls.append(make_wall(cx + GAP//2, 0, ROOM_W - cx - GAP//2, WALL))
    else:
        walls.append(make_wall(0, 0, ROOM_W, WALL))
    # Bottom
    if SOUTH in exits:
        cx = exits[SOUTH].get('offset', GAP_CENTER_X)
        walls.append(make_wall(0, ROOM_H - WALL, cx - GAP//2, WALL))
        walls.append(make_wall(cx + GAP//2, ROOM_H - WALL, ROOM_W - cx - GAP//2, WALL))
    else:
        walls.append(make_wall(0, ROOM_H - WALL, ROOM_W, WALL))
    # Left
    if WEST in exits:
        cy = exits[WEST].get('offset', GAP_CENTER_Y)
        walls.append(make_wall(0, 0, WALL, cy - GAP//2))
        walls.append(make_wall(0, cy + GAP//2, WALL, ROOM_H - cy - GAP//2))
    else:
        walls.append(make_wall(0, 0, WALL, ROOM_H))
    # Right
    if EAST in exits:
        cy = exits[EAST].get('offset', GAP_CENTER_Y)
        walls.append(make_wall(ROOM_W - WALL, 0, WALL, cy - GAP//2))
        walls.append(make_wall(ROOM_W - WALL, cy + GAP//2, WALL, ROOM_H - cy - GAP//2))
    else:
        walls.append(make_wall(ROOM_W - WALL, 0, WALL, ROOM_H))
    return walls


# Room definitions
ROOMS = {
    'golden_castle': {
        'name': 'Golden Castle',
        'color': ROOM_COLORS['golden_castle'],
        'exits': {
            SOUTH: {'room': 'golden_foyer', 'offset': GAP_CENTER_X},
        },
        'gates': [
            {'dir': SOUTH, 'key': 'gold_key', 'rect': None}  # rect filled at runtime
        ],
        'inner_walls': [],
    },
    'golden_foyer': {
        'name': 'Golden Foyer',
        'color': ROOM_COLORS['golden_foyer'],
        'exits': {
            NORTH: {'room': 'golden_castle', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'overworld', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'overworld_east', 'offset': GAP_CENTER_Y},
            WEST:  {'room': 'overworld_west', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [],
    },
    'overworld': {
        'name': 'The Kingdom',
        'color': ROOM_COLORS['overworld'],
        'exits': {
            NORTH: {'room': 'golden_foyer', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'overworld_south', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'overworld_east', 'offset': GAP_CENTER_Y},
            WEST:  {'room': 'overworld_west', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [
            make_wall(200, 100, 20, 160),
            make_wall(500, 200, 20, 160),
            make_wall(300, 300, 200, 20),
        ],
    },
    'overworld_east': {
        'name': 'Eastern Plains',
        'color': ROOM_COLORS['overworld_east'],
        'exits': {
            WEST:  {'room': 'overworld', 'offset': GAP_CENTER_Y},
            NORTH: {'room': 'white_foyer', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'catacomb1', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'maze1', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [
            make_wall(300, 150, 20, 200),
            make_wall(500, 100, 180, 20),
        ],
    },
    'overworld_west': {
        'name': 'Western Plains',
        'color': ROOM_COLORS['overworld_west'],
        'exits': {
            EAST:  {'room': 'overworld', 'offset': GAP_CENTER_Y},
            NORTH: {'room': 'black_foyer', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'valley', 'offset': GAP_CENTER_X},
            WEST:  {'room': 'blue_maze1', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [
            make_wall(200, 200, 20, 180),
            make_wall(400, 120, 160, 20),
        ],
    },
    'overworld_south': {
        'name': 'Southern Valley',
        'color': ROOM_COLORS['overworld_south'],
        'exits': {
            NORTH: {'room': 'overworld', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'catacomb2', 'offset': GAP_CENTER_Y},
            WEST:  {'room': 'catacomb3', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [
            make_wall(160, 160, 480, 20),
            make_wall(160, 340, 480, 20),
            make_wall(160, 160, 20, 200),
            make_wall(620, 160, 20, 200),
        ],
    },
    'white_castle': {
        'name': 'White Castle',
        'color': ROOM_COLORS['white_castle'],
        'exits': {
            SOUTH: {'room': 'white_foyer', 'offset': GAP_CENTER_X},
        },
        'gates': [
            {'dir': SOUTH, 'key': 'white_key', 'rect': None}
        ],
        'inner_walls': [],
    },
    'white_foyer': {
        'name': 'White Foyer',
        'color': ROOM_COLORS['white_foyer'],
        'exits': {
            NORTH: {'room': 'white_castle', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'overworld_east', 'offset': GAP_CENTER_X},
            WEST:  {'room': 'overworld', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [],
    },
    'black_castle': {
        'name': 'Black Castle',
        'color': ROOM_COLORS['black_castle'],
        'exits': {
            SOUTH: {'room': 'black_foyer', 'offset': GAP_CENTER_X},
        },
        'gates': [
            {'dir': SOUTH, 'key': 'black_key', 'rect': None}
        ],
        'inner_walls': [],
    },
    'black_foyer': {
        'name': 'Black Foyer',
        'color': ROOM_COLORS['black_foyer'],
        'exits': {
            NORTH: {'room': 'black_castle', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'overworld_west', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'overworld', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [],
    },
    'catacomb1': {
        'name': 'Catacombs',
        'color': ROOM_COLORS['catacomb1'],
        'exits': {
            NORTH: {'room': 'overworld_east', 'offset': GAP_CENTER_X},
            WEST:  {'room': 'catacomb2', 'offset': GAP_CENTER_Y},
            SOUTH: {'room': 'maze2', 'offset': GAP_CENTER_X},
        },
        'gates': [],
        'inner_walls': [
            make_wall(100, 100, 20, 320),
            make_wall(200, 100, 20, 200),
            make_wall(100, 300, 100, 20),
            make_wall(400, 200, 20, 220),
            make_wall(600, 100, 20, 200),
        ],
    },
    'catacomb2': {
        'name': 'Deep Catacombs',
        'color': ROOM_COLORS['catacomb2'],
        'exits': {
            EAST:  {'room': 'catacomb1', 'offset': GAP_CENTER_Y},
            NORTH: {'room': 'overworld_south', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'catacomb3', 'offset': GAP_CENTER_X},
        },
        'gates': [],
        'inner_walls': [
            make_wall(200, 100, 400, 20),
            make_wall(200, 400, 400, 20),
            make_wall(200, 100, 20, 320),
            make_wall(580, 100, 20, 320),
            make_wall(350, 200, 20, 200),
        ],
    },
    'catacomb3': {
        'name': 'Catacombs West',
        'color': ROOM_COLORS['catacomb3'],
        'exits': {
            NORTH: {'room': 'catacomb2', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'catacomb2', 'offset': GAP_CENTER_Y},
            WEST:  {'room': 'overworld_south', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [
            make_wall(300, 150, 200, 20),
            make_wall(300, 350, 200, 20),
            make_wall(300, 150, 20, 220),
            make_wall(480, 150, 20, 220),
        ],
    },
    'maze1': {
        'name': 'The Maze',
        'color': ROOM_COLORS['maze1'],
        'exits': {
            WEST:  {'room': 'overworld_east', 'offset': GAP_CENTER_Y},
            EAST:  {'room': 'maze2', 'offset': GAP_CENTER_Y},
            NORTH: {'room': 'blue_maze2', 'offset': GAP_CENTER_X},
        },
        'gates': [],
        'inner_walls': [
            make_wall(80, 80, 20, 200),
            make_wall(80, 80, 200, 20),
            make_wall(260, 80, 20, 120),
            make_wall(80, 280, 140, 20),
            make_wall(380, 120, 20, 200),
            make_wall(260, 280, 140, 20),
            make_wall(500, 80, 20, 120),
            make_wall(500, 300, 20, 120),
            make_wall(380, 300, 140, 20),
            make_wall(600, 120, 160, 20),
            make_wall(600, 300, 20, 120),
            make_wall(140, 340, 20, 140),
            make_wall(140, 340, 240, 20),
            make_wall(360, 340, 20, 80),
        ],
    },
    'maze2': {
        'name': 'Maze East',
        'color': ROOM_COLORS['maze2'],
        'exits': {
            WEST:  {'room': 'maze1', 'offset': GAP_CENTER_Y},
            EAST:  {'room': 'maze3', 'offset': GAP_CENTER_Y},
            NORTH: {'room': 'catacomb1', 'offset': GAP_CENTER_X},
        },
        'gates': [],
        'inner_walls': [
            make_wall(100, 60, 600, 20),
            make_wall(100, 60, 20, 180),
            make_wall(100, 220, 200, 20),
            make_wall(280, 220, 20, 180),
            make_wall(280, 380, 200, 20),
            make_wall(460, 220, 20, 180),
            make_wall(460, 60, 20, 180),
            make_wall(460, 220, 160, 20),
            make_wall(600, 60, 20, 340),
            make_wall(200, 380, 20, 100),
        ],
    },
    'maze3': {
        'name': 'Maze Depths',
        'color': ROOM_COLORS['maze3'],
        'exits': {
            WEST:  {'room': 'maze2', 'offset': GAP_CENTER_Y},
            SOUTH: {'room': 'blue_maze3', 'offset': GAP_CENTER_X},
        },
        'gates': [],
        'inner_walls': [
            make_wall(80, 80, 640, 20),
            make_wall(80, 80, 20, 360),
            make_wall(80, 420, 640, 20),
            make_wall(200, 200, 20, 240),
            make_wall(200, 200, 200, 20),
            make_wall(380, 200, 20, 120),
            make_wall(380, 300, 160, 20),
            make_wall(520, 200, 20, 120),
            make_wall(380, 80, 20, 140),
        ],
    },
    'blue_maze1': {
        'name': 'Blue Labyrinth',
        'color': ROOM_COLORS['blue_maze1'],
        'exits': {
            EAST:  {'room': 'overworld_west', 'offset': GAP_CENTER_Y},
            NORTH: {'room': 'blue_maze2', 'offset': GAP_CENTER_X},
            SOUTH: {'room': 'blue_maze3', 'offset': GAP_CENTER_X},
        },
        'gates': [],
        'inner_walls': [
            make_wall(100, 100, 20, 160),
            make_wall(100, 100, 280, 20),
            make_wall(360, 100, 20, 80),
            make_wall(100, 240, 200, 20),
            make_wall(280, 160, 20, 100),
            make_wall(500, 80, 20, 200),
            make_wall(500, 260, 200, 20),
            make_wall(360, 300, 20, 120),
            make_wall(360, 400, 160, 20),
            make_wall(600, 100, 20, 300),
            make_wall(200, 340, 20, 140),
            make_wall(200, 460, 300, 20),
        ],
    },
    'blue_maze2': {
        'name': 'Blue Labyrinth II',
        'color': ROOM_COLORS['blue_maze2'],
        'exits': {
            SOUTH: {'room': 'blue_maze1', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'maze1', 'offset': GAP_CENTER_Y},
            WEST:  {'room': 'secret_passage', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [
            make_wall(100, 80, 20, 360),
            make_wall(100, 80, 500, 20),
            make_wall(580, 80, 20, 360),
            make_wall(100, 420, 500, 20),
            make_wall(200, 180, 20, 260),
            make_wall(200, 180, 200, 20),
            make_wall(380, 180, 20, 120),
            make_wall(380, 280, 120, 20),
            make_wall(480, 180, 20, 120),
        ],
    },
    'blue_maze3': {
        'name': 'Blue Labyrinth III',
        'color': ROOM_COLORS['blue_maze3'],
        'exits': {
            NORTH: {'room': 'maze3', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'blue_maze1', 'offset': GAP_CENTER_Y},
            SOUTH: {'room': 'valley', 'offset': GAP_CENTER_X},
        },
        'gates': [],
        'inner_walls': [
            make_wall(80, 80, 640, 20),
            make_wall(80, 80, 20, 360),
            make_wall(80, 420, 300, 20),
            make_wall(460, 420, 260, 20),
            make_wall(200, 180, 20, 260),
            make_wall(200, 420, 20, 80),
            make_wall(320, 80, 20, 200),
            make_wall(320, 260, 200, 20),
            make_wall(500, 80, 20, 200),
            make_wall(400, 80, 20, 140),
        ],
    },
    'valley': {
        'name': 'Valley of Peril',
        'color': ROOM_COLORS['valley'],
        'exits': {
            NORTH: {'room': 'overworld_west', 'offset': GAP_CENTER_X},
            EAST:  {'room': 'blue_maze3', 'offset': GAP_CENTER_Y},
        },
        'gates': [],
        'inner_walls': [
            make_wall(200, 200, 400, 20),
            make_wall(200, 300, 400, 20),
            make_wall(200, 200, 20, 120),
            make_wall(580, 200, 20, 120),
        ],
    },
    'secret_passage': {
        'name': 'Secret Passage',
        'color': ROOM_COLORS['secret_passage'],
        'exits': {
            EAST:  {'room': 'blue_maze2', 'offset': GAP_CENTER_Y},
            NORTH: {'room': 'easter_egg_room', 'offset': 200},  # special offset
        },
        'gates': [],
        'inner_walls': [
            make_wall(100, 100, 600, 20),
            make_wall(100, 400, 600, 20),
            make_wall(100, 100, 20, 320),
            make_wall(680, 100, 20, 320),
            make_wall(300, 200, 200, 20),
            make_wall(300, 300, 200, 20),
            make_wall(300, 200, 20, 120),
        ],
    },
    'easter_egg_room': {
        'name': '???',
        'color': ROOM_COLORS['easter_egg_room'],
        'exits': {
            SOUTH: {'room': 'secret_passage', 'offset': 200},
        },
        'gates': [],
        'inner_walls': [],
    },
}


# Pre-compute walls for each room
for room_id, room in ROOMS.items():
    exits_simple = {d: v for d, v in room['exits'].items()}
    room['walls'] = border_walls(exits_simple) + room['inner_walls']


# Gate rects (blocking passage south = strip at bottom of room)
def compute_gate_rect(direction, offset=None):
    if offset is None:
        offset = GAP_CENTER_X if direction in (NORTH, SOUTH) else GAP_CENTER_Y
    if direction == SOUTH:
        return pygame.Rect(offset - GAP//2, ROOM_H - WALL - 16, GAP, 16)
    if direction == NORTH:
        return pygame.Rect(offset - GAP//2, WALL, GAP, 16)
    if direction == EAST:
        return pygame.Rect(ROOM_W - WALL - 16, offset - GAP//2, 16, GAP)
    if direction == WEST:
        return pygame.Rect(WALL, offset - GAP//2, 16, GAP)

for room_id, room in ROOMS.items():
    for gate in room['gates']:
        exit_info = room['exits'].get(gate['dir'], {})
        offset = exit_info.get('offset', None)
        gate['rect'] = compute_gate_rect(gate['dir'], offset)


# --- Item definitions ---
# Items: id, name, color, size, shape ('rect' or 'diamond' or 'cross')
ITEM_DEFS = {
    'chalice': {
        'name': 'Enchanted Chalice',
        'color': YELLOW,
        'shape': 'chalice',
        'size': (20, 28),
    },
    'sword': {
        'name': 'Sword',
        'color': WHITE,
        'shape': 'sword',
        'size': (40, 12),
    },
    'gold_key': {
        'name': 'Gold Key',
        'color': YELLOW,
        'shape': 'key',
        'size': (30, 14),
    },
    'white_key': {
        'name': 'White Key',
        'color': WHITE,
        'shape': 'key',
        'size': (30, 14),
    },
    'black_key': {
        'name': 'Black Key',
        'color': GRAY,
        'shape': 'key',
        'size': (30, 14),
    },
    'bridge': {
        'name': 'Bridge',
        'color': BROWN,
        'shape': 'bridge',
        'size': (50, 16),
    },
    'magnet': {
        'name': 'Magnet',
        'color': RED,
        'shape': 'magnet',
        'size': (26, 26),
    },
    'dot': {
        'name': '',  # invisible name
        'color': WHITE,
        'shape': 'dot',
        'size': (4, 4),
    },
}

# Initial positions: (room_id, x, y)
ITEM_STARTS = {
    'chalice':   ('black_castle',   380, 200),
    'sword':     ('overworld',      300, 250),
    'gold_key':  ('catacomb1',      400, 300),
    'white_key': ('valley',         400, 350),
    'black_key': ('maze3',          400, 280),
    'bridge':    ('catacomb2',      400, 280),
    'magnet':    ('overworld_south', 400, 280),
    'dot':       ('blue_maze1',     195, 260),  # 1-pixel easter egg dot
}


# --- Drawing helpers ---

def draw_item(surf, item_id, x, y, size=None):
    d = ITEM_DEFS[item_id]
    shape = d['shape']
    color = d['color']
    w, h = size or d['size']

    if shape == 'rect' or shape == 'key':
        pygame.draw.rect(surf, color, (x - w//2, y - h//2, w, h))
        if shape == 'key':
            pygame.draw.circle(surf, color, (x - w//2 + 8, y), 8)
            pygame.draw.rect(surf, color, (x + w//2 - 8, y - h//2, 8, h))
    elif shape == 'chalice':
        # Cup shape
        pygame.draw.rect(surf, color, (x - w//2, y - h//2, w, h//2))
        pygame.draw.rect(surf, color, (x - 4, y, 8, h//4))
        pygame.draw.rect(surf, color, (x - w//2, y + h//4, w, h//4))
    elif shape == 'sword':
        pygame.draw.rect(surf, color, (x - w//2, y - 3, w - 8, 6))
        pygame.draw.rect(surf, color, (x + w//2 - 8, y - h//2, 8, h))
        pygame.draw.rect(surf, color, (x - 12, y - h//2, 24, h))
    elif shape == 'bridge':
        pygame.draw.rect(surf, color, (x - w//2, y - h//2, w, h))
        for i in range(4):
            bx = x - w//2 + i * (w//3)
            pygame.draw.rect(surf, BLACK, (bx + 4, y - h//2, 6, h))
    elif shape == 'magnet':
        pygame.draw.rect(surf, color, (x - w//2, y - h//2, w//3, h))
        pygame.draw.rect(surf, color, (x + w//2 - w//3, y - h//2, w//3, h))
        pygame.draw.rect(surf, color, (x - w//2, y - h//2, w, h//3))
        pygame.draw.rect(surf, (200, 200, 200), (x - w//2, y - h//2, w//3, h//4))
        pygame.draw.rect(surf, BLUE, (x + w//2 - w//3, y - h//2, w//3, h//4))
    elif shape == 'dot':
        pygame.draw.rect(surf, color, (x - 2, y - 2, 4, 4))


def draw_dragon(surf, dragon):
    x, y = int(dragon['x']), int(dragon['y'])
    color = dragon['color']
    # Dragon body: elongated rect
    body_w, body_h = 44, 24
    pygame.draw.rect(surf, color, (x - body_w//2, y - body_h//2, body_w, body_h))
    # Head
    pygame.draw.rect(surf, color, (x + body_w//2 - 4, y - 14, 18, 18))
    # Eye
    pygame.draw.rect(surf, BLACK, (x + body_w//2 + 6, y - 10, 4, 4))
    # Tail
    pygame.draw.polygon(surf, color, [
        (x - body_w//2, y - 8),
        (x - body_w//2 - 20, y - 16),
        (x - body_w//2 - 20, y + 4),
        (x - body_w//2, y + 8),
    ])
    # Legs
    for lx in [x - 12, x + 8]:
        pygame.draw.rect(surf, color, (lx, y + body_h//2, 10, 12))


def draw_bat(surf, bat):
    x, y = int(bat['x']), int(bat['y'])
    color = (30, 30, 30)
    # W shape (two V's)
    pts = [
        (x - 28, y - 12),
        (x - 16, y + 8),
        (x - 4,  y - 4),
        (x,      y + 12),
        (x + 4,  y - 4),
        (x + 16, y + 8),
        (x + 28, y - 12),
    ]
    pygame.draw.lines(surf, WHITE, False, pts, 3)
    pygame.draw.circle(surf, color, (x, y + 4), 6)


def draw_player(surf, px, py, color=ORANGE):
    pygame.draw.rect(surf, color, (px - PLAYER_SIZE//2, py - PLAYER_SIZE//2, PLAYER_SIZE, PLAYER_SIZE))


# --- Game State ---

class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
        pygame.display.set_caption("Adventure")
        self.clock = pygame.time.Clock()
        self.font_large = pygame.font.SysFont('monospace', 36, bold=True)
        self.font_med   = pygame.font.SysFont('monospace', 22, bold=True)
        self.font_small = pygame.font.SysFont('monospace', 16)

        # Sound setup
        pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=512)
        self.sounds = self._init_sounds()

        self.state = 'playing'  # 'playing', 'dead', 'won'
        self.reset()

    def _init_sounds(self):
        sounds = {}
        try:
            rate = 22050
            def make_tone(freq, dur, vol=0.3, wave='sine'):
                frames = int(rate * dur)
                arr = []
                for i in range(frames):
                    t = i / rate
                    if wave == 'sine':
                        v = math.sin(2 * math.pi * freq * t)
                    else:
                        v = 1.0 if (i % (rate // freq)) < (rate // freq // 2) else -1.0
                    arr.append(int(v * vol * 32767))
                import array as arr_mod
                buf = arr_mod.array('h', arr)
                return pygame.sndarray.make_sound(pygame.sndarray.make_surface(
                    pygame.surfarray.pixels2d(pygame.Surface((1,1)))
                )) if False else None

            # Simple beep using pygame.mixer directly
            def beep(freq, dur, vol=0.2):
                import array as arr_mod
                frames = int(rate * dur)
                buf = arr_mod.array('h', [
                    int(math.sin(2 * math.pi * freq * i / rate) * vol * 32767)
                    for i in range(frames)
                ])
                sound = pygame.sndarray.make_sound(
                    __import__('numpy').array(buf, dtype='int16').reshape(-1, 1)
                    if False else buf
                )
                return sound

            import array as arr_mod
            def make_sound(freq, dur, vol=0.25, wave='sine'):
                frames = int(rate * dur)
                buf = arr_mod.array('h')
                for i in range(frames):
                    t = i / rate
                    if wave == 'sine':
                        v = math.sin(2 * math.pi * freq * t)
                    else:
                        phase = (i % max(1, rate // int(freq))) / max(1, rate // int(freq))
                        v = 1.0 if phase < 0.5 else -1.0
                    sample = int(v * vol * 32767)
                    buf.append(sample)
                    buf.append(sample)  # stereo
                return pygame.sndarray.make_sound(buf)

            sounds['pickup']  = make_sound(440, 0.1)
            sounds['drop']    = make_sound(330, 0.08)
            sounds['death']   = make_sound(100, 0.5, wave='square')
            sounds['win']     = make_sound(880, 0.4)
            sounds['roar']    = make_sound(80,  0.15, wave='square')
            sounds['door']    = make_sound(220, 0.12)
        except Exception:
            pass
        return sounds

    def play_sound(self, name):
        s = self.sounds.get(name)
        if s:
            try:
                s.play()
            except Exception:
                pass

    def reset(self):
        self.current_room = 'golden_foyer'
        self.px = ROOM_W // 2
        self.py = ROOM_H // 2
        self.speed = 4
        self.held_item = None   # item_id or None
        self.dead = False
        self.won  = False
        self.state = 'playing'
        self.transition = None  # dict with animation data
        self.death_timer = 0
        self.win_timer   = 0
        self.invincible  = 0    # frames of post-death invincibility

        # Item locations: {item_id: {'room': room_id, 'x': x, 'y': y}} or None if held
        self.items = {}
        for iid, (room, x, y) in ITEM_STARTS.items():
            self.items[iid] = {'room': room, 'x': float(x), 'y': float(y)}

        # Easter egg: dot visibility — only visible if player visited secret passage
        self.dot_visible = True
        self.easter_egg_revealed = False

        # Dragons
        self.dragons = [
            {
                'id': 'yorgle',
                'name': 'Yorgle',
                'color': YELLOW,
                'room': 'white_foyer',
                'x': 300.0, 'y': 300.0,
                'dx': 1.5, 'dy': 0.8,
                'speed': 1.8,
                'alive': True,
                'personality': 'guard',  # flees sword
                'has_item': None,
            },
            {
                'id': 'grumble',
                'name': 'Grumble',
                'color': GREEN,
                'room': 'catacomb2',
                'x': 400.0, 'y': 250.0,
                'dx': -1.2, 'dy': 1.4,
                'speed': 1.5,
                'alive': True,
                'personality': 'erratic',
                'has_item': None,
            },
            {
                'id': 'rhindle',
                'name': 'Rhindle',
                'color': RED,
                'room': 'overworld_east',
                'x': 500.0, 'y': 300.0,
                'dx': 2.0, 'dy': -1.5,
                'speed': 2.5,
                'alive': True,
                'personality': 'aggressive',
                'has_item': None,
            },
        ]

        # Bat
        self.bat = {
            'room': 'overworld',
            'x': 400.0, 'y': 200.0,
            'dx': 2.5, 'dy': 1.8,
            'has_item': None,
            'think_timer': 0,
        }

    # --- Room helpers ---
    def room(self):
        return ROOMS[self.current_room]

    def walls(self):
        return self.room()['walls']

    def player_rect(self):
        return pygame.Rect(
            self.px - PLAYER_SIZE//2, self.py - PLAYER_SIZE//2,
            PLAYER_SIZE, PLAYER_SIZE
        )

    def item_rect(self, iid):
        info = self.items[iid]
        w, h = ITEM_DEFS[iid]['size']
        return pygame.Rect(info['x'] - w//2, info['y'] - h//2, w, h)

    def dragon_rect(self, d):
        return pygame.Rect(d['x'] - 22, d['y'] - 12, 44, 24)

    def bat_rect(self):
        return pygame.Rect(self.bat['x'] - 28, self.bat['y'] - 12, 56, 24)

    # --- Input / Movement ---
    def handle_input(self):
        keys = pygame.key.get_pressed()
        dx = dy = 0
        if keys[pygame.K_LEFT]  or keys[pygame.K_a]: dx = -self.speed
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]: dx =  self.speed
        if keys[pygame.K_UP]    or keys[pygame.K_w]: dy = -self.speed
        if keys[pygame.K_DOWN]  or keys[pygame.K_s]: dy =  self.speed

        if dx or dy:
            self.move_player(dx, dy)

    def move_player(self, dx, dy):
        pr = self.player_rect()
        new_x = self.px + dx
        new_y = self.py + dy
        nr = pygame.Rect(new_x - PLAYER_SIZE//2, new_y - PLAYER_SIZE//2, PLAYER_SIZE, PLAYER_SIZE)

        # Check gate blocking first
        for gate in self.room()['gates']:
            gr = gate['rect']
            key_needed = gate['key']
            if nr.colliderect(gr):
                if self.held_item != key_needed:
                    # Blocked
                    if dx != 0:
                        new_x = self.px
                    if dy != 0:
                        new_y = self.py
                    nr = pygame.Rect(new_x - PLAYER_SIZE//2, new_y - PLAYER_SIZE//2, PLAYER_SIZE, PLAYER_SIZE)

        # Wall collisions
        for wall in self.walls():
            if nr.colliderect(wall):
                # Try sliding
                nr_x = pygame.Rect(new_x - PLAYER_SIZE//2, self.py - PLAYER_SIZE//2, PLAYER_SIZE, PLAYER_SIZE)
                nr_y = pygame.Rect(self.px - PLAYER_SIZE//2, new_y - PLAYER_SIZE//2, PLAYER_SIZE, PLAYER_SIZE)
                if dx and nr_x.colliderect(wall):
                    new_x = self.px
                if dy and nr_y.colliderect(wall):
                    new_y = self.py

        self.px, self.py = new_x, new_y
        self.check_room_transition()

    def check_room_transition(self):
        room_data = self.room()
        exits = room_data['exits']

        entered = None
        new_x, new_y = self.px, self.py

        if self.py < WALL and NORTH in exits:
            entered = NORTH
            new_y = ROOM_H - WALL - PLAYER_SIZE
        elif self.py > ROOM_H - WALL and SOUTH in exits:
            entered = SOUTH
            new_y = WALL + PLAYER_SIZE
        elif self.px < WALL and WEST in exits:
            entered = WEST
            new_x = ROOM_W - WALL - PLAYER_SIZE
        elif self.px > ROOM_W - WALL and EAST in exits:
            entered = EAST
            new_x = WALL + PLAYER_SIZE

        if entered:
            next_room = exits[entered]['room']
            self.current_room = next_room
            self.px, self.py = new_x, new_y
            self.play_sound('door')

            # Check easter egg: if player carries dot into secret_passage north wall
            if entered == NORTH and self.current_room == 'easter_egg_room' and self.held_item == 'dot':
                self.easter_egg_revealed = True

    # --- Items ---
    def try_pickup(self):
        if self.held_item:
            return
        pr = self.player_rect()
        for iid, info in self.items.items():
            if info is None:
                continue
            if info['room'] != self.current_room:
                continue
            ir = self.item_rect(iid)
            if pr.colliderect(ir):
                self.held_item = iid
                self.items[iid] = None  # mark as held
                self.play_sound('pickup')
                return

    def try_drop(self):
        if not self.held_item:
            return
        iid = self.held_item
        self.items[iid] = {'room': self.current_room, 'x': float(self.px + 30), 'y': float(self.py)}
        self.held_item = None
        self.play_sound('drop')

    # --- Dragons ---
    def update_dragons(self):
        for d in self.dragons:
            if not d['alive']:
                continue
            self._update_dragon(d)

    def _update_dragon(self, d):
        in_same_room = (d['room'] == self.current_room)
        player_has_sword = (self.held_item == 'sword')

        if in_same_room:
            pdx = self.px - d['x']
            pdy = self.py - d['y']
            dist = math.hypot(pdx, pdy)

            if d['personality'] == 'guard' and player_has_sword:
                # Flee
                if dist > 0:
                    d['dx'] = -pdx / dist * d['speed'] * 1.2
                    d['dy'] = -pdy / dist * d['speed'] * 1.2
            elif d['personality'] == 'aggressive' or (d['personality'] == 'guard' and not player_has_sword):
                # Chase
                if dist > 5:
                    d['dx'] = pdx / dist * d['speed']
                    d['dy'] = pdy / dist * d['speed']
            elif d['personality'] == 'erratic':
                # Random direction changes
                if random.random() < 0.02:
                    angle = random.uniform(0, 2 * math.pi)
                    d['dx'] = math.cos(angle) * d['speed']
                    d['dy'] = math.sin(angle) * d['speed']
                if dist < 200 and random.random() < 0.05:
                    d['dx'] = pdx / dist * d['speed'] if dist > 0 else 0
                    d['dy'] = pdy / dist * d['speed'] if dist > 0 else 0

        # Move
        d['x'] += d['dx']
        d['y'] += d['dy']

        # Bounce off walls in current room
        room_data = ROOMS[d['room']]
        dr = self.dragon_rect(d)
        for wall in room_data['walls']:
            if dr.colliderect(wall):
                # Push out and reverse
                if abs(d['dx']) > abs(d['dy']):
                    d['dx'] *= -1
                    d['x'] += d['dx'] * 2
                else:
                    d['dy'] *= -1
                    d['y'] += d['dy'] * 2
                break

        # Clamp
        d['x'] = max(WALL + 22, min(ROOM_W - WALL - 22, d['x']))
        d['y'] = max(WALL + 12, min(ROOM_H - WALL - 12, d['y']))

        # Dragon picks up items in its room
        if d['has_item'] is None:
            for iid, info in self.items.items():
                if info is None:
                    continue
                if info['room'] != d['room']:
                    continue
                ir = self.item_rect(iid)
                if self.dragon_rect(d).colliderect(ir):
                    d['has_item'] = iid
                    self.items[iid] = None
                    break

        # Move held item with dragon
        if d['has_item']:
            iid = d['has_item']
            if self.items[iid] is None:
                pass  # kept as None while held

        # Dragon roams between rooms occasionally
        if random.random() < 0.002:
            exits = list(ROOMS[d['room']]['exits'].items())
            if exits:
                chosen_dir, chosen_exit = random.choice(exits)
                d['room'] = chosen_exit['room']
                d['x'] = float(ROOM_W // 2 + random.randint(-100, 100))
                d['y'] = float(ROOM_H // 2 + random.randint(-100, 100))
                # Drop held item in new room
                if d['has_item']:
                    iid = d['has_item']
                    self.items[iid] = {'room': d['room'], 'x': d['x'] + 40, 'y': d['y']}
                    d['has_item'] = None

        # Check sword kill
        if in_same_room and player_has_sword:
            pr = self.player_rect()
            if pr.colliderect(self.dragon_rect(d)):
                d['alive'] = False
                if d['has_item']:
                    iid = d['has_item']
                    self.items[iid] = {'room': d['room'], 'x': d['x'], 'y': d['y']}
                    d['has_item'] = None
                self.play_sound('roar')
                return

        # Check dragon kills player
        if in_same_room and not player_has_sword and self.invincible <= 0:
            pr = self.player_rect()
            if pr.colliderect(self.dragon_rect(d)):
                self._die()

    def _die(self):
        self.state = 'dead'
        self.play_sound('death')

    # --- Bat ---
    def update_bat(self):
        b = self.bat
        b['think_timer'] -= 1

        # Move
        b['x'] += b['dx']
        b['y'] += b['dy']

        # Bounce off walls
        room_data = ROOMS[b['room']]
        br = self.bat_rect()
        for wall in room_data['walls']:
            if br.colliderect(wall):
                if abs(b['dx']) > abs(b['dy']):
                    b['dx'] *= -1
                else:
                    b['dy'] *= -1
                b['x'] = max(WALL + 28, min(ROOM_W - WALL - 28, b['x']))
                b['y'] = max(WALL + 12, min(ROOM_H - WALL - 12, b['y']))
                break

        b['x'] = max(WALL + 28, min(ROOM_W - WALL - 28, b['x']))
        b['y'] = max(WALL + 12, min(ROOM_H - WALL - 12, b['y']))

        # Bat steals items periodically
        if b['think_timer'] <= 0:
            b['think_timer'] = random.randint(120, 300)

            if b['has_item'] is None:
                # Try to steal from player if bat is in player's room
                if b['room'] == self.current_room and self.held_item:
                    stolen = self.held_item
                    self.held_item = None
                    b['has_item'] = stolen
                    self.items[stolen] = None
                else:
                    # Try to steal from room
                    room_items = [iid for iid, info in self.items.items()
                                  if info and info['room'] == b['room']]
                    if room_items:
                        stolen = random.choice(room_items)
                        b['has_item'] = stolen
                        self.items[stolen] = None
            else:
                # Drop item in a random room
                all_rooms = list(ROOMS.keys())
                drop_room = random.choice(all_rooms)
                iid = b['has_item']
                self.items[iid] = {
                    'room': drop_room,
                    'x': float(ROOM_W // 2 + random.randint(-150, 150)),
                    'y': float(ROOM_H // 2 + random.randint(-100, 100)),
                }
                b['has_item'] = None

        # Bat roams
        if random.random() < 0.003:
            exits = list(ROOMS[b['room']]['exits'].items())
            if exits:
                _, chosen_exit = random.choice(exits)
                b['room'] = chosen_exit['room']
                b['x'] = float(ROOM_W // 2 + random.randint(-100, 100))
                b['y'] = float(ROOM_H // 2 + random.randint(-50, 50))

    # --- Win check ---
    def check_win(self):
        if self.held_item == 'chalice' and self.current_room == 'golden_castle':
            self.state = 'won'
            self.play_sound('win')

    # --- Magnet ---
    def apply_magnet(self):
        if self.held_item != 'magnet':
            return
        pr = self.player_rect()
        for iid, info in self.items.items():
            if info is None:
                continue
            if info['room'] != self.current_room:
                continue
            dx = self.px - info['x']
            dy = self.py - info['y']
            dist = math.hypot(dx, dy)
            if 0 < dist < 200:
                info['x'] += dx / dist * 2
                info['y'] += dy / dist * 2

    # --- Update ---
    def update(self):
        if self.state != 'playing':
            return
        if self.invincible > 0:
            self.invincible -= 1
        self.update_dragons()
        self.update_bat()
        self.check_win()
        self.apply_magnet()

    # --- Draw ---
    def draw_room(self, surf):
        room_data = self.room()
        # Background
        surf.fill(room_data['color'])
        # Walls
        for wall in room_data['walls']:
            pygame.draw.rect(surf, DARK_GRAY, wall)
            pygame.draw.rect(surf, GRAY, wall.inflate(-4, -4))
        # Gate(s)
        for gate in room_data['gates']:
            gr = gate['rect']
            key_needed = gate['key']
            if self.held_item == key_needed:
                # Open — draw as open passage color
                pygame.draw.rect(surf, room_data['color'], gr)
            else:
                # Closed gate
                pygame.draw.rect(surf, ORANGE, gr)
                pygame.draw.rect(surf, (200, 100, 0), gr.inflate(-4, -4))

    def draw_items(self, surf):
        for iid, info in self.items.items():
            if info is None:
                continue
            if info['room'] != self.current_room:
                continue
            if iid == 'dot' and not self.dot_visible:
                continue
            draw_item(surf, iid, int(info['x']), int(info['y']))

    def draw_entities(self, surf):
        # Dragons in current room
        for d in self.dragons:
            if d['alive'] and d['room'] == self.current_room:
                draw_dragon(surf, d)
        # Bat
        if self.bat['room'] == self.current_room:
            draw_bat(surf, self.bat)

    def draw_player_sprite(self, surf):
        alpha = 255
        if self.invincible > 0 and (self.invincible // 4) % 2 == 0:
            return  # flicker
        draw_player(surf, self.px, self.py)
        if self.held_item:
            draw_item(surf, self.held_item, self.px + 20, self.py - 20, size=None)

    def draw_hud(self, surf):
        # HUD area below playfield
        hud_y = ROOM_H
        pygame.draw.rect(surf, (10, 10, 30), (0, hud_y, SCREEN_W, HUD_H))
        pygame.draw.line(surf, GRAY, (0, hud_y), (SCREEN_W, hud_y), 2)

        room_name = self.room()['name']
        txt = self.font_med.render(room_name, True, WHITE)
        surf.blit(txt, (20, hud_y + 10))

        if self.held_item:
            d = ITEM_DEFS[self.held_item]
            label = self.font_small.render(f"Holding: {d['name']}", True, YELLOW)
            surf.blit(label, (20, hud_y + 42))
        else:
            label = self.font_small.render("Holding: nothing", True, GRAY)
            surf.blit(label, (20, hud_y + 42))

        # Minimap dragon indicators
        mx = SCREEN_W - 200
        dtxt = self.font_small.render("Dragons:", True, WHITE)
        surf.blit(dtxt, (mx, hud_y + 8))
        alive_count = sum(1 for d in self.dragons if d['alive'])
        for i, d in enumerate(self.dragons):
            c = d['color'] if d['alive'] else DARK_GRAY
            pygame.draw.rect(surf, c, (mx + i*30, hud_y + 30, 20, 20))

        # Controls hint
        hint = self.font_small.render("WASD/Arrows: move  E: pickup  Q: drop", True, (100, 100, 100))
        surf.blit(hint, (SCREEN_W//2 - hint.get_width()//2, hud_y + 58))

    def draw_easter_egg(self, surf):
        surf.fill((40, 0, 40))
        lines = [
            "* * * * * * * * * * * * *",
            "",
            "   Created by",
            "   Yves Perodin Jr",
            "",
            "   A tribute to Warren Robinett",
            "   who hid his name in the original",
            "   Adventure (1980) when Atari",
            "   refused to credit programmers.",
            "",
            "* * * * * * * * * * * * *",
        ]
        start_y = 120
        for i, line in enumerate(lines):
            color = YELLOW if 'Yves' in line or 'Warren' in line else WHITE
            txt = self.font_med.render(line, True, color)
            surf.blit(txt, (SCREEN_W//2 - txt.get_width()//2, start_y + i * 34))

    def draw_dead_screen(self, surf):
        overlay = pygame.Surface((SCREEN_W, SCREEN_H), pygame.SRCALPHA)
        overlay.fill((180, 0, 0, 160))
        surf.blit(overlay, (0, 0))
        t1 = self.font_large.render("YOU WERE EATEN!", True, WHITE)
        t2 = self.font_med.render("Press R to restart or Q to quit", True, YELLOW)
        surf.blit(t1, (SCREEN_W//2 - t1.get_width()//2, SCREEN_H//2 - 60))
        surf.blit(t2, (SCREEN_W//2 - t2.get_width()//2, SCREEN_H//2 + 20))

    def draw_win_screen(self, surf):
        overlay = pygame.Surface((SCREEN_W, SCREEN_H), pygame.SRCALPHA)
        overlay.fill((0, 160, 60, 160))
        surf.blit(overlay, (0, 0))
        t1 = self.font_large.render("YOU WIN!", True, YELLOW)
        t2 = self.font_med.render("The Enchanted Chalice is restored!", True, WHITE)
        t3 = self.font_med.render("Press R to restart or Q to quit", True, YELLOW)
        surf.blit(t1, (SCREEN_W//2 - t1.get_width()//2, SCREEN_H//2 - 80))
        surf.blit(t2, (SCREEN_W//2 - t2.get_width()//2, SCREEN_H//2))
        surf.blit(t3, (SCREEN_W//2 - t3.get_width()//2, SCREEN_H//2 + 60))

    def draw(self):
        surf = self.screen

        if self.current_room == 'easter_egg_room' and self.easter_egg_revealed:
            self.draw_easter_egg(surf)
        else:
            # Draw playfield
            playfield = pygame.Surface((ROOM_W, ROOM_H))
            self.draw_room(playfield)
            self.draw_items(playfield)
            self.draw_entities(playfield)
            self.draw_player_sprite(playfield)
            surf.blit(playfield, (0, 0))
            self.draw_hud(surf)

        if self.state == 'dead':
            self.draw_dead_screen(surf)
        elif self.state == 'won':
            self.draw_win_screen(surf)

        pygame.display.flip()

    # --- Main loop ---
    def run(self):
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_q:
                        pygame.quit()
                        sys.exit()
                    if event.key == pygame.K_r:
                        self.reset()
                    if self.state == 'playing':
                        if event.key == pygame.K_e:
                            if self.held_item:
                                self.try_drop()
                            else:
                                self.try_pickup()
                        if event.key == pygame.K_SPACE:
                            if self.held_item:
                                self.try_drop()
                            else:
                                self.try_pickup()

            if self.state == 'playing':
                self.handle_input()
                self.update()

            self.draw()
            self.clock.tick(FPS)


# --- Entry point ---
if __name__ == '__main__':
    game = Game()
    game.run()

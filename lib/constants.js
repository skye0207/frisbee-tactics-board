import { uuid } from './uuid';

export const FIELD_WIDTH = 100;
export const FIELD_HEIGHT = 60;

export const makePiece = (type, index = 0, overrides = {}) => ({
  id: uuid(),
  type,
  x: type === 'offense' ? 24 + (index % 4) * 10 : type === 'defense' ? 58 + (index % 4) * 8 : 48,
  y: type === 'disc' ? 30 : 15 + (index % 4) * 10,
  label: type === 'offense' ? `O${index + 1}` : type === 'defense' ? `D${index + 1}` : '',
  ...overrides
});

export const createStarterFrame = (name = '第 1 页') => ({
  id: uuid(),
  name,
  duration: 900,
  pieces: [
    makePiece('offense', 0, { x: 28, y: 18 }),
    makePiece('offense', 1, { x: 28, y: 30 }),
    makePiece('offense', 2, { x: 28, y: 42 }),
    makePiece('defense', 0, { x: 52, y: 19 }),
    makePiece('defense', 1, { x: 52, y: 31 }),
    makePiece('defense', 2, { x: 52, y: 43 }),
    makePiece('disc', 0, { x: 24, y: 30 })
  ]
});

export const createBlankTactic = (title = '未命名战术') => ({
  id: uuid(),
  title,
  description: '从第一帧开始布置阵型，再复制页面并移动队员形成动画。',
  frames: [createStarterFrame()],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

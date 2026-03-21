'use client';
import { AVATARS } from '../lib/constants.js';

export default function AvatarImg({ src, avatar, size = 36, style = {} }) {
  const raw = src || avatar;
  const validSrc = (raw && raw.startsWith('/avatars/') && raw.endsWith('.png')) ? raw : AVATARS[0];
  return <img src={validSrc} alt="" style={{
    width:size, height:size, objectFit:'contain', flexShrink:0,
    ...style
  }} />;
}

'use client';
import { AVATARS } from '../lib/constants.js';

export default function AvatarImg({ src, size = 36, style = {} }) {
  const validSrc = (src && src.startsWith('/avatars/')) ? src : AVATARS[0];
  return <img src={validSrc} alt="" style={{
    width:size, height:size, objectFit:'contain', flexShrink:0,
    ...style
  }} />;
}

'use client';
import { AVATARS } from '../lib/constants.js';

export default function AvatarImg({ src, avatar, size = 36, style = {} }) {
  const imageUrl = src || avatar;
  const validSrc = (imageUrl && imageUrl.startsWith('/avatars/') && imageUrl.endsWith('.png')) ? imageUrl : AVATARS[0];
  return <img src={validSrc} alt="" style={{
    width:size, height:size, objectFit:'contain', flexShrink:0,
    ...style
  }} />;
}

'use client';
import { AVATARS } from '../lib/constants.js';

export default function AvatarImg({ src, avatar, size = 36, style = {} }) {
  const imageUrl = src || avatar;
  // b.363 — si accettano tutte e due le estensioni: i nuovi avatar sono
  // .webp, ma chi ne ha uno salvato da prima lo ha in .png e non deve
  // vederselo sostituire.
  const validSrc = (imageUrl && imageUrl.startsWith('/avatars/') && /\.(png|webp)$/.test(imageUrl)) ? imageUrl : AVATARS[0];
  return <img src={validSrc} alt="" style={{
    width:size, height:size, objectFit:'contain', flexShrink:0,
    ...style
  }} />;
}

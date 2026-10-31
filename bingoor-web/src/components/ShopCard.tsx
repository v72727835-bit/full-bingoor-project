'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { fitClass } from '../lib/art';
import { Shop } from '../lib/types';
import { Icon } from './Icon';
import { Badge, Rating } from './ui';
import s from './ShopCard.module.css';

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link href={`/search?shop=${shop.slug}`} className={s.card}>
      <span className={s.logo}>
        <Image src={shop.logo || shop.art} alt="" width={96} height={96} className={fitClass(shop.logo, s.logoArt)} unoptimized />
      </span>
      <span className={s.body}>
        <span className={s.top}>
          <span className={`${s.name} clamp-1`}>{shop.name}</span>
          {shop.isOpen ? <Badge tone="ok">Open</Badge> : <Badge tone="bad">Closed</Badge>}
        </span>
        {shop.description || shop.address ? (
          <span className={`${s.desc} clamp-1`}>{shop.description || shop.address}</span>
        ) : null}
        <span className={s.facts}>
          <Rating value={shop.rating} count={shop.ratingCount} size={11.5} />
          {shop.deliveryFee !== undefined ? (
            <span className={s.fact}>
              <Icon name="truck" size={13} />
              {shop.deliveryFee === 0 ? 'Free delivery' : `₹${shop.deliveryFee} delivery`}
            </span>
          ) : null}
          {shop.minOrderAmount ? (
            <span className={s.fact}>
              <Icon name="tag" size={13} />₹{shop.minOrderAmount} min
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

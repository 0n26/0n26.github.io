import { AspectRatio, Image, Text } from '@mantine/core';
import { Link } from 'react-router';
import type { CatalogEntry } from '../../sources/source';
import styles from './ReleaseCard.module.css';

export function ReleaseCard({ to, entry }: { to: string; entry: CatalogEntry }) {
  return (
    <Link to={to} className={styles.card}>
      <AspectRatio ratio={2 / 3} className={styles.poster}>
        {entry.poster
          ? <Image src={entry.poster} alt="" loading="lazy" decoding="async" />
          : <div className={styles.placeholder}>Нет постера</div>}
      </AspectRatio>
      <Text fw={650} lineClamp={2} className={styles.cardTitle}>{entry.name}</Text>
      {entry.year && <Text size="sm" c="dimmed">{entry.year}</Text>}
    </Link>
  );
}
import { Alert, Button, Group, Loader, Pagination, SimpleGrid, Text, Title } from '@mantine/core';
import { catalogSourceKey } from '../../catalog/titleRef';
import type { CatalogResult } from '../../sources/source';
import { ReleaseCard } from './ReleaseCard';
import { titleHref } from './titleLinks';
import type { SourceRequest } from './useSourceRequest';

export function CatalogResults({ query, filtered, request, changePage }: {
  query: string;
  filtered: boolean;
  request: SourceRequest<CatalogResult>;
  changePage: (page: number) => void;
}) {
  return (
    <>
      <Title order={2} size="h3">{query ? 'Результаты поиска' : 'В каталоге'}</Title>
      {request.status === 'loading' && (
        <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем каталог…</Text></Group>
      )}
      {request.status === 'error' && (
        <Alert role="alert" color="red" title="Не удалось загрузить каталог">Проверьте подключение и обновите страницу.</Alert>
      )}
      {request.status === 'ready' && (
        <>
          {request.data.incomplete && (
            <Alert color="yellow" title="Неполная выдача">
              Не все источники ответили. Часть результатов может отсутствовать.
            </Alert>
          )}
          {request.data.page > request.data.totalPages ? (
            <Alert color="gray" title="Страница не найдена">
              <Button variant="light" size="xs" onClick={() => changePage(1)}>К первой странице</Button>
            </Alert>
          ) : request.data.items.length === 0 ? (
            <Text role="status" c="dimmed">
              {request.data.page > 1 ? 'На этой странице нет новых тайтлов.'
                : query || filtered ? 'Ничего не найдено. Измените запрос или фильтры.' : 'Каталог пуст.'}
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} spacing={{ base: 'sm', sm: 'md' }} verticalSpacing="lg">
              {request.data.items.map((entry) => (
                <ReleaseCard key={entry.alias} to={titleHref(catalogSourceKey, entry.alias)} entry={entry} />
              ))}
            </SimpleGrid>
          )}
          {request.data.page <= request.data.totalPages && request.data.totalPages > 1 && (
            <nav aria-label="Страницы каталога">
              <Pagination
                layout="responsive"
                size="sm"
                siblings={0}
                total={request.data.totalPages}
                value={request.data.page}
                onChange={changePage}
                formatLabel={({ page, totalPages }) => `Страница ${page} из ${totalPages}`}
                getControlProps={(control) => ({ 'aria-label': control === 'previous' ? 'Предыдущая страница' : 'Следующая страница' })}
                getItemProps={(number) => ({ 'aria-label': `Страница ${number}` })}
              />
            </nav>
          )}
        </>
      )}
    </>
  );
}

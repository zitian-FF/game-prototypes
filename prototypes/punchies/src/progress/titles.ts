import { t } from '../i18n';
import cfg from './progress-config.json';

export const TITLE_IDS: string[] = cfg.titles.map((x) => x.id);
export const isTitleId = (v: unknown): v is string => typeof v === 'string' && TITLE_IDS.includes(v);
export const titleName = (id: string): string => t(`title.${isTitleId(id) ? id : TITLE_IDS[0]}`);

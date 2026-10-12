import {t} from '../i18n';
import type {Super} from '../sim/super';
/** Literal keys keep strict localization validation; metadata decides the ability, never fighter IDs. */
export function superName(key:Super['nameKey']):string {
 switch(key){case 'super.rising_upper':return t('super.rising_upper');case 'super.code_x':return t('super.code_x');case 'super.buffalo_hook':return t('super.buffalo_hook');}
 const unsupported:never=key;void unsupported;return t('common.super');
}
export function superDescription(key:Super['descriptionKey']):string {
 switch(key){case 'super.rising_upper_description':return t('super.rising_upper_description');case 'super.code_x_description':return t('super.code_x_description');case 'super.buffalo_hook_description':return t('super.buffalo_hook_description');}
 const unsupported:never=key;void unsupported;return '';
}

import type { EmojiMartData } from '@slidoapp/emoji-mart-data';
import { lazy, Suspense } from 'react';
import { ActionIcon, Loader, SimpleGrid, Tabs, useMantineColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';

const pageEmojis = [
  ['📄','문서 document'],['📝','메모 note'],['📋','목록 list'],['📓','노트 notebook'],['📚','책 공부 study'],['📖','독서 book'],['🗂️','폴더 정리 folder'],['📁','자료 folder'],
  ['🗓️','일정 calendar'],['📅','달력 calendar'],['📌','중요 pin'],['📍','위치 location'],['🏷️','태그 label'],['🔖','북마크 bookmark'],['📎','첨부 attachment'],['🧾','영수증 receipt'],
  ['💡','아이디어 idea'],['🎯','목표 target'],['🚀','프로젝트 rocket'],['✅','완료 check'],['☑️','할일 checkbox'],['⭐','즐겨찾기 star'],['🔥','열정 fire'],['🏆','성과 trophy'],
  ['💻','개발 컴퓨터 computer'],['⌨️','키보드 keyboard'],['🖥️','모니터 desktop'],['🛠️','도구 tools'],['⚙️','설정 gear'],['🧪','실험 test'],['🔬','연구 research'],['🧬','과학 science'],
  ['📊','통계 chart'],['📈','성장 growth'],['📉','감소 decline'],['💰','돈 money'],['💳','결제 card'],['🪙','동전 coin'],['🏦','은행 bank'],['🧮','계산 calculator'],
  ['🏠','집 home'],['🏢','업무 office'],['🛒','쇼핑 shopping'],['🎁','선물 gift'],['🧹','청소 cleaning'],['🪴','식물 plant'],['🌿','자연 nature'],['🌱','새싹 sprout'],
  ['🎨','디자인 art'],['🖌️','그림 paint'],['📷','사진 camera'],['🎬','영상 movie'],['🎵','음악 music'],['🎧','듣기 headphone'],['🎮','게임 game'],['🧩','퍼즐 puzzle'],
  ['✈️','여행 travel'],['🚗','자동차 car'],['🚆','기차 train'],['🧳','짐 luggage'],['🗺️','지도 map'],['🧭','방향 compass'],['🏕️','캠핑 camping'],['🏖️','휴가 beach'],
  ['☕','커피 coffee'],['🍵','차 tea'],['🍽️','식사 meal'],['🍳','요리 cooking'],['🍎','사과 apple'],['🍰','케이크 cake'],['🍜','면 noodle'],['🥗','샐러드 salad'],
  ['❤️','사랑 heart'],['💙','파랑 blue'],['💚','초록 green'],['💜','보라 purple'],['💛','노랑 yellow'],['🤍','하양 white'],['🖤','검정 black'],['🌈','무지개 rainbow'],
  ['👋','인사 hello'],['😊','웃음 smile'],['🥳','축하 party'],['🤔','생각 thinking'],['💪','건강 운동 health'],['🏃','달리기 running'],['🧘','명상 yoga'],['😴','수면 sleep'],
  ['🐶','강아지 dog'],['🐱','고양이 cat'],['🐰','토끼 rabbit'],['🦊','여우 fox'],['🐻','곰 bear'],['🦋','나비 butterfly'],['🌸','꽃 flower'],['🌙','밤 moon'],
] as const;
const FullPicker = lazy(async () => {
  const [picker, module, ko] = await Promise.all([import('@slidoapp/emoji-mart-react'), import('@slidoapp/emoji-mart-data'), import('@slidoapp/emoji-mart-data/i18n/ko.json')]);
  const data = structuredClone(module.default) as unknown as EmojiMartData;
  const entries = Object.values(data.emojis);
  for (const [native, words] of pageEmojis) {
    const entry = entries.find(emoji => emoji.skins.some(skin => skin.native === native));
    if (entry) entry.keywords = [...new Set([...entry.keywords, ...words.split(' ')])];
  }
  const Picker = picker.default;
  return { default: ({ korean, ...props }: any) => <Picker {...props} data={data} i18n={korean ? ko.default : undefined} /> };
});
export default function PageEmojiPalette({ onSelect, disabled }: { onSelect: (native: string) => void; disabled: boolean }) {
  const { t, i18n } = useTranslation('page-emojis'), { colorScheme } = useMantineColorScheme();
  const compact = useMediaQuery('(max-width: 380px)');
  return <Tabs defaultValue="all" keepMounted={false}>
    <Tabs.List><Tabs.Tab value="all">{t('all')}</Tabs.Tab><Tabs.Tab value="suggested">{t('suggested')}</Tabs.Tab></Tabs.List>
    <Tabs.Panel value="all" pt="xs"><Suspense fallback={<Loader size="sm" />}>
      <FullPicker key={compact ? "compact" : "regular"} korean={i18n.language.startsWith('ko')} theme={colorScheme} autoFocus={false}
        perLine={compact ? 6 : 8} previewPosition="none" onEmojiSelect={(emoji: { native: string }) => { if (!disabled) onSelect(emoji.native); }} />
    </Suspense></Tabs.Panel>
    <Tabs.Panel value="suggested" pt="xs"><SimpleGrid cols={compact ? 6 : 8} spacing={4}>
      {pageEmojis.map(([native, name]) => <ActionIcon key={native} variant="subtle" size={30} disabled={disabled}
        aria-label={i18n.language.startsWith('ko') ? name : native} title={name} onClick={() => onSelect(native)}>{native}</ActionIcon>)}
    </SimpleGrid></Tabs.Panel>
  </Tabs>;
}

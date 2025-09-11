import openapi from '../../../openapi.json';

const getPrefectureParameter = () => {
  const params = openapi.paths['/api/v2/events/'].get.parameters;
  return params.find((p: any) => p.name === 'prefecture');
};

const parsePrefectures = () => {
  const prefectureParam = getPrefectureParameter();
  if (!prefectureParam) {
    return [];
  }
  const description = (prefectureParam.schema as any).description;
  const lines = description.split('\n');
  const prefectures: { name: string; value: string }[] = [];
  const regex = /^\*\s*`(.+?)`\s*:\s*(.+?)\s*$/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const value = match[1];
      const name = match[2];
      prefectures.push({ name: `${name} (${value})`, value });
    }
  }
  return prefectures;
};

export const prefectures = parsePrefectures();

export interface Presentation {
  id: number;
  title: string;
  speakerName: string;
  description: string;
  url?: string;
  slideshareUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  order: number;
  updatedAt: string;
}

export interface PresentationsResponse {
  presentationsReturned: number;
  presentations: Presentation[];
}
import configJson from '../../drops.config.json';

export interface DropsConfig {
  repo: {
    owner: string;
    admin: string;
    name: string;
    url: string;
  };
  site: {
    title: string;
    description: string;
    basePath: string;
  };
  discussions: {
    category: string;
  };
  features: {
    mockPosts: boolean;
    comments: boolean;
  };
}

export const config: DropsConfig = configJson as DropsConfig;

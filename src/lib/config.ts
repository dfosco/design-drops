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
    siteUrl: string;
  };
  discussions: {
    category: string;
    projects?: string[];
  };
  features: {
    mockPosts: boolean;
    comments: boolean;
  };
  access: {
    allowedDomains: string[];
    allowedEmails: string[];
  };
}

export const config: DropsConfig = configJson as DropsConfig;

import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../../observability/logger.js'

export class BaseScraper {
  constructor(userAgent = process.env.USER_AGENT) {
    this.userAgent = userAgent
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': userAgent
      }
    })
  }

  async fetch(url, options = {}) {
    try {
      logger.info(`Fetching ${url}`)
      const response = await this.client.get(url, options)
      return response.data
    } catch (error) {
      logger.error(`Failed to fetch ${url}`, { error: error.message })
      throw error
    }
  }

  async fetchJson(url, options = {}) {
    const data = await this.fetch(url, options)
    return typeof data === 'object' ? data : JSON.parse(data)
  }

  async fetchHtml(url, options = {}) {
    const html = await this.fetch(url, options)
    return cheerio.load(html)
  }

  // Override in subclasses that need Playwright
  async fetchWithBrowser(url) {
    throw new Error('Browser scraping not implemented for this source')
  }
}
import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../observability/logger.js'

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

  async fetchJsonSafe(url, options = {}) {
    try {
      return await this.fetchJson(url, options)
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn(`Optional JSON not found (404): ${url}`)
        return null
      }
      throw error
    }
  }

  async fetchHtml(url, options = {}) {
    const html = await this.fetch(url, options)
    return cheerio.load(html)
  }

  async fetchHtmlSafe(url, options = {}) {
    try {
      const html = await this.fetch(url, options)
      if (!html) return null
      return cheerio.load(html)
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn(`Optional HTML not found (404): ${url}`)
        return null
      }
      throw error
    }
  }

  // Override in subclasses that need Playwright
  async fetchWithBrowser(url) {
    throw new Error('Browser scraping not implemented for this source')
  }
}
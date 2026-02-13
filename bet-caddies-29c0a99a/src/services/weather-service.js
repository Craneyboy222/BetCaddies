import axios from 'axios'
import { logger } from '../observability/logger.js'

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast'
const PLAYING_HOUR_START = 7  // 7 AM local
const PLAYING_HOUR_END = 18   // 6 PM local

/**
 * Format a Date as YYYY-MM-DD string.
 */
const formatDate = (date) => {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

/**
 * Add N days to a Date.
 */
const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Fetch weather forecast for a golf tournament from Open-Meteo.
 * Returns per-round weather aggregates (wind, temperature, rain) for playing hours.
 *
 * Open-Meteo is free (no API key needed, 10k requests/day limit).
 * On failure, returns null — the engine runs without weather as graceful fallback.
 *
 * @param {number} lat - Course latitude
 * @param {number} lng - Course longitude
 * @param {Date|string} startDate - Tournament start date
 * @param {number} rounds - Number of rounds (default 4, LIV uses 3)
 * @returns {{ rounds: Array<{ avgWindSpeed, maxWindGust, avgTemp, rainProbability }> } | null}
 */
export const fetchWeatherForEvent = async (lat, lng, startDate, rounds = 4) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !startDate) {
    return null
  }

  const start = new Date(startDate)
  const end = addDays(start, rounds - 1)

  try {
    const response = await axios.get(OPEN_METEO_BASE, {
      params: {
        latitude: lat,
        longitude: lng,
        hourly: 'temperature_2m,windspeed_10m,windgusts_10m,precipitation_probability,rain',
        timezone: 'auto',
        start_date: formatDate(start),
        end_date: formatDate(end)
      },
      timeout: 10000
    })

    const hourly = response.data?.hourly
    if (!hourly || !hourly.time) {
      logger.warn('V3 weather: empty response from Open-Meteo', { lat, lng })
      return null
    }

    // Parse hourly data into per-day aggregates for playing hours
    const roundWeather = []
    for (let day = 0; day < rounds; day++) {
      const targetDate = formatDate(addDays(start, day))
      const dayData = {
        windSpeeds: [],
        windGusts: [],
        temps: [],
        rainProbs: []
      }

      for (let i = 0; i < hourly.time.length; i++) {
        const time = hourly.time[i]
        if (!time.startsWith(targetDate)) continue

        // Extract hour from ISO format "2026-02-13T07:00"
        const hour = parseInt(time.split('T')[1]?.split(':')[0], 10)
        if (hour < PLAYING_HOUR_START || hour >= PLAYING_HOUR_END) continue

        if (Number.isFinite(hourly.windspeed_10m?.[i])) dayData.windSpeeds.push(hourly.windspeed_10m[i])
        if (Number.isFinite(hourly.windgusts_10m?.[i])) dayData.windGusts.push(hourly.windgusts_10m[i])
        if (Number.isFinite(hourly.temperature_2m?.[i])) dayData.temps.push(hourly.temperature_2m[i])
        if (Number.isFinite(hourly.precipitation_probability?.[i])) dayData.rainProbs.push(hourly.precipitation_probability[i])
      }

      roundWeather.push({
        avgWindSpeed: dayData.windSpeeds.length > 0
          ? dayData.windSpeeds.reduce((a, b) => a + b, 0) / dayData.windSpeeds.length
          : 0,
        maxWindGust: dayData.windGusts.length > 0
          ? Math.max(...dayData.windGusts)
          : 0,
        avgTemp: dayData.temps.length > 0
          ? dayData.temps.reduce((a, b) => a + b, 0) / dayData.temps.length
          : 20,
        rainProbability: dayData.rainProbs.length > 0
          ? Math.max(...dayData.rainProbs)
          : 0
      })
    }

    logger.info('V3 weather fetched', {
      lat, lng, rounds,
      summary: roundWeather.map((r, i) => ({
        round: i + 1,
        wind: r.avgWindSpeed.toFixed(1),
        gust: r.maxWindGust.toFixed(1),
        temp: r.avgTemp.toFixed(1),
        rain: r.rainProbability
      }))
    })

    return { rounds: roundWeather }
  } catch (error) {
    logger.warn('V3 weather fetch failed — running without weather', {
      lat, lng,
      error: error.message
    })
    return null
  }
}

import { NextResponse } from 'next/server'
import { isLocale } from '@/lib/i18n/routing'
import en from '@/lib/i18n/en.json'
import ms from '@/lib/i18n/ms.json'

export async function GET(_request: Request, {params}: {params: Promise<{locale:string}>}) {
  const {locale} = await params
  if (!isLocale(locale)) return NextResponse.json({error:'Unsupported locale'}, {status:404})
  return NextResponse.json({locale, messages:locale === 'ms' ? ms : en}, {headers:{'Content-Language':locale, 'Cache-Control':'public, max-age=3600'}})
}

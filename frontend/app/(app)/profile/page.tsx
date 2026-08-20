"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import { Skeleton } from "boneyard-js/react"
import { isBoneyardBuild } from "@/lib/boneyard"
import { toast } from "sonner"
import {
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  Share2,
  Trash2,
  User,
  UserRound,
  X,
} from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import PageIntro from "@/components/page-intro"
import { listMyShares, revokeShare, type MyShare } from "@/lib/api"
import { cn } from "@/lib/utils"

const COPY = {
  ms: {
    eyebrow: "Akaun",
    title: "Profil",
    description: "Butiran akaun dan semua jawapan yang anda kongsi.",
    account: "Maklumat Akaun",
    shares: "Perkongsian Saya",
    sharesDesc: "Jawapan yang telah anda kongsi sebagai pautan awam.",
    noShares: "Belum ada perkongsian.",
    noSharesDesc:
      "Kongsi jawapan dari ruang kerja dan ia akan muncul di sini.",
    open: "Buka",
    revoke: "Padam",
    confirmRevoke: "Pasti padam?",
    revoked: "Perkongsian dipadam.",
    failed: "Gagal memuatkan perkongsian.",
    signOut: "Log keluar",
    memberSince: "Ahli sejak",
    noEmail: "Tiada e-mel",
    anonymous: "Tetamu",
  },
  en: {
    eyebrow: "Account",
    title: "Profile",
    description: "Your account details and every answer you've shared.",
    account: "Account",
    shares: "My Shared Answers",
    sharesDesc: "Answers you've published as public share links.",
    noShares: "No shares yet.",
    noSharesDesc: "Share an answer from the workspace and it will appear here.",
    open: "Open",
    revoke: "Delete",
    confirmRevoke: "Delete?",
    revoked: "Share deleted.",
    failed: "Failed to load shares.",
    signOut: "Sign out",
    memberSince: "Member since",
    noEmail: "No email",
    anonymous: "Guest",
  },
  zh: {
    eyebrow: "账户",
    title: "个人资料",
    description: "您的账户详情以及您分享过的所有回答。",
    account: "账户信息",
    shares: "我的分享",
    sharesDesc: "您发布为公开链接的回答。",
    noShares: "暂无分享。",
    noSharesDesc: "在工作区分享回答后，它会显示在这里。",
    open: "打开",
    revoke: "删除",
    confirmRevoke: "确认删除？",
    revoked: "分享已删除。",
    failed: "加载分享失败。",
    signOut: "退出登录",
    memberSince: "加入于",
    noEmail: "无邮箱",
    anonymous: "访客",
  },
}

function formatDate(iso: string, language: string) {
  try {
    return new Date(iso).toLocaleDateString(
      language.startsWith("ms")
        ? "ms-MY"
        : language.startsWith("zh")
          ? "zh-CN"
          : "en-US",
      { day: "numeric", month: "short", year: "numeric" }
    )
  } catch {
    return ""
  }
}

function ConfidenceBadge({ label }: { label: string }) {
  if (!label) return null
  const high = label === "high"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm",
        high
          ? "bg-success/10 text-success"
          : "bg-warning/10 text-warning"
      )}
    >
      <ShieldCheck className="h-3 w-3" />
      {high ? "High" : label === "low" ? "Verify" : "Medium"}
    </span>
  )
}

function ProfileFixture() {
  const { language } = useLanguage()
  const copy = COPY[language] ?? COPY.en
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="overflow-hidden rounded-lg border border-border bg-card lg:col-span-1">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            <UserRound className="h-3.5 w-3.5" />
            {copy.account}
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold text-foreground">Ahmad Bin Abdullah</p>
            <p className="mt-0.5 text-xs text-muted-foreground">ahmad@example.com</p>
          </div>
          <div className="neo-btn inline-flex w-full items-center justify-center gap-2 bg-background px-4 py-2 text-xs font-medium text-destructive">
            <LogOut className="h-3.5 w-3.5" />
            {copy.signOut}
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-lg border border-border bg-card lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            <Share2 className="h-3.5 w-3.5" />
            {copy.shares}
          </div>
        </div>
        <div className="space-y-2.5 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">JPN</span>
                  <span className="rounded-sm bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">High</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="neo-btn inline-flex items-center gap-1.5 bg-background px-3 py-1.5 text-xs font-medium text-primary">
                  <ExternalLink className="h-3 w-3" />
                  {copy.open}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function ProfilePage() {
  const { language } = useLanguage()
  const copy = COPY[language] ?? COPY.en
  const { user, isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  const [shares, setShares] = useState<MyShare[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null)

  const loadShares = useCallback(async () => {
    if (!isSignedIn) return
    setLoading(true)
    const rows = await listMyShares()
    setShares(rows)
    setLoading(false)
  }, [isSignedIn])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      if (isBoneyardBuild()) return
      router.replace("/sign-in")
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShares()
  }, [isLoaded, isSignedIn, router, loadShares])

  const handleRevoke = async (slug: string) => {
    if (confirmingSlug !== slug) {
      setConfirmingSlug(slug)
      return
    }
    setConfirmingSlug(null)
    const ok = await revokeShare(slug)
    if (ok) {
      setShares((prev) => prev.filter((s) => s.slug !== slug))
      toast.success(copy.revoked)
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-full flex-col p-4 sm:p-8">
        <Skeleton
          name="profile-page"
          loading={!isLoaded || !isSignedIn}
          fallback={
            <>
              <div className="h-32 w-full rounded-lg border border-border bg-card" />
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="h-72 rounded-lg border border-border bg-card lg:col-span-1" />
                <div className="h-72 rounded-lg border border-border bg-card lg:col-span-2" />
              </div>
            </>
          }
          fixture={<ProfileFixture />}
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-72 rounded-lg border border-border bg-card lg:col-span-1" />
            <div className="h-72 rounded-lg border border-border bg-card lg:col-span-2" />
          </div>
        </Skeleton>
      </div>
    )
  }

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null
  const displayName = user.fullName || user.username || copy.anonymous

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
        <PageIntro
          icon={User}
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Account card */}
          <section className="overflow-hidden rounded-lg border border-border bg-card lg:col-span-1">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                <UserRound className="h-3.5 w-3.5" />
                {copy.account}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
              <div className="relative">
                {user.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.imageUrl}
                    alt={displayName}
                    className="h-20 w-20 rounded-full border border-primary/30 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate font-heading text-lg font-semibold text-foreground">
                  {displayName}
                </p>
                {email ? (
                  <p className="mt-0.5 flex items-center justify-center gap-1.5 truncate text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{email}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {copy.noEmail}
                  </p>
                )}
                {user.createdAt ? (
                  <p className="mt-2 text-[11px] text-muted-foreground/70">
                    {copy.memberSince} ·{" "}
                    {formatDate(user.createdAt.toISOString(), language)}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="neo-btn inline-flex w-full items-center justify-center gap-2 bg-background px-4 py-2 text-xs font-medium text-destructive hover:border-destructive/40 hover:bg-destructive/5"
              >
                <LogOut className="h-3.5 w-3.5" />
                {copy.signOut}
              </button>
            </div>
          </section>

          {/* Shared answers */}
          <section className="overflow-hidden rounded-lg border border-border bg-card lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                <Share2 className="h-3.5 w-3.5" />
                {copy.shares}
              </div>
              {shares.length > 0 ? (
                <span className="rounded-sm border border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {shares.length}
                </span>
              ) : null}
              <p className="w-full text-xs text-muted-foreground sm:w-auto">
                {copy.sharesDesc}
              </p>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  …
                </div>
              ) : shares.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Share2 className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground">
                    {copy.noShares}
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    {copy.noSharesDesc}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {shares.map((share) => (
                    <li
                      key={share.slug}
                      className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm leading-snug text-foreground">
                          {share.question}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {share.agency ? (
                            <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              {share.agency}
                            </span>
                          ) : null}
                          <ConfidenceBadge label={share.confidence_label} />
                          <span className="text-[11px] text-muted-foreground/70">
                            {formatDate(share.created_at, language)}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/share/${share.slug}`}
                          className="neo-btn inline-flex items-center gap-1.5 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:border-primary/40 hover:bg-primary/5"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {copy.open}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRevoke(share.slug)}
                          aria-label={copy.revoke}
                          title={copy.revoke}
                          className={cn(
                            "neo-btn inline-flex items-center gap-1.5 bg-background px-3 py-1.5 text-xs font-medium",
                            confirmingSlug === share.slug
                              ? "border-destructive/40 text-destructive hover:bg-destructive/5"
                              : "text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                          )}
                        >
                          {confirmingSlug === share.slug ? (
                            <>
                              <X className="h-3 w-3" />
                              {copy.confirmRevoke}
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3" />
                              {copy.revoke}
                            </>
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
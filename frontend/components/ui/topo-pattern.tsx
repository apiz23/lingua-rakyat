import { cn } from "@/lib/utils"

interface TopoPatternProps {
  className?: string
}

export function TopoPattern({ className }: TopoPatternProps) {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className={cn("absolute inset-0 h-full w-full", className)}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" strokeWidth="1.2" className="topo-strokes">
        {/* Group 1 — y ≈ 88–155 | slow upward drift */}
        <g style={{ animation: "topo-up 68s ease-in-out infinite", animationDelay: "-10s" }}>
          <path d="M-100 88 C180 64,420 112,680 82 S960 108,1240 76 S1480 100,1640 88" />
          <path d="M-100 108 C200 88,460 132,740 100 S1040 126,1320 96 S1540 118,1640 108" />
          <path d="M-100 130 C220 110,500 152,760 122 S1060 148,1340 118 S1550 140,1640 130" />
          <path d="M-100 155 C190 135,480 175,740 147 S1040 171,1340 141 S1560 163,1640 155" />
        </g>

        {/* Group 2 — y ≈ 285–368 | downward drift */}
        <g style={{ animation: "topo-down 56s ease-in-out infinite", animationDelay: "-25s" }}>
          <path d="M-100 285 C230 265,500 308,770 278 S1080 302,1370 272 S1560 294,1640 285" />
          <path d="M-100 310 C260 290,540 332,820 302 S1120 326,1420 296 S1580 318,1640 310" />
          <path d="M-100 338 C180 318,450 360,720 330 S1020 354,1320 322 S1560 346,1640 338" />
          <path d="M-100 368 C240 348,520 390,800 360 S1100 382,1400 352 S1570 374,1640 368" />
        </g>

        {/* Group 3 — y ≈ 484–562 | slow upward drift */}
        <g style={{ animation: "topo-up 82s ease-in-out infinite", animationDelay: "-38s" }}>
          <path d="M-100 484 C200 466,460 504,730 476 S1030 500,1330 472 S1560 492,1640 484" />
          <path d="M-100 508 C220 490,490 528,770 498 S1060 524,1360 494 S1570 516,1640 508" />
          <path d="M-100 535 C180 517,450 555,720 527 S1020 551,1310 521 S1560 543,1640 535" />
          <path d="M-100 562 C200 544,470 582,750 554 S1050 578,1350 548 S1565 570,1640 562" />
        </g>

        {/* Group 4 — y ≈ 665–718 | downward drift */}
        <g style={{ animation: "topo-down 64s ease-in-out infinite", animationDelay: "-52s" }}>
          <path d="M-100 665 C190 647,460 685,740 657 S1040 681,1330 651 S1565 673,1640 665" />
          <path d="M-100 690 C220 670,500 710,780 682 S1080 706,1370 676 S1570 698,1640 690" />
          <path d="M-100 718 C200 700,470 738,750 710 S1040 734,1340 704 S1570 726,1640 718" />
        </g>

        {/* Group 5 — y ≈ 825–877 | slow upward drift */}
        <g style={{ animation: "topo-up 74s ease-in-out infinite", animationDelay: "-18s" }}>
          <path d="M-100 825 C180 807,450 845,720 817 S1020 841,1320 811 S1560 833,1640 825" />
          <path d="M-100 852 C220 834,500 872,780 844 S1080 868,1380 838 S1570 860,1640 852" />
          <path d="M-100 877 C200 859,470 897,750 869 S1040 893,1330 863 S1560 885,1640 877" />
        </g>
      </g>
    </svg>
  )
}

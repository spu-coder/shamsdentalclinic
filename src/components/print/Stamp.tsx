export function ClinicStamp({ size = 108 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="ختم عيادة شمس السنية التخصصية"
    >
      <defs>
        <path id="stamp-arc-top" d="M 28 100 A 72 72 0 0 1 172 100" />
        <path id="stamp-arc-bottom" d="M 172 108 A 72 72 0 0 1 28 108" />
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke="#0e8a8f" strokeWidth="4" />
      <circle cx="100" cy="100" r="84" fill="none" stroke="#0e8a8f" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="58" fill="none" stroke="#0e8a8f" strokeWidth="1.5" />
      <text fill="#0e8a8f" fontSize="15" fontWeight="700">
        <textPath href="#stamp-arc-top" startOffset="50%" textAnchor="middle">
          عيادة شمس السنية التخصصية
        </textPath>
      </text>
      <text fill="#0e8a8f" fontSize="12" fontWeight="600">
        <textPath href="#stamp-arc-bottom" startOffset="50%" textAnchor="middle">
          عين منين — طريق حلبون
        </textPath>
      </text>
      <text
        x="100"
        y="94"
        fill="#0e8a8f"
        fontSize="15"
        fontWeight="800"
        textAnchor="middle"
      >
        د. ياسر شمس الدين
      </text>
      <text x="100" y="116" fill="#0e8a8f" fontSize="11" textAnchor="middle">
        مالك المركز ومديره
      </text>
      <path
        d="M 62 128 q 38 14 76 0"
        fill="none"
        stroke="#0e8a8f"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DoctorSignature({ width = 190 }: { width?: number }) {
  return (
    <svg width={width} height={width * 0.42} viewBox="0 0 220 92" role="img" aria-label="توقيع د. ياسر زكريا شمس الدين">
      <text
        x="112"
        y="46"
        textAnchor="middle"
        fill="#123b46"
        fontSize="27"
        fontWeight="700"
        fontStyle="italic"
        fontFamily="'Reem Kufi','Cairo',serif"
      >
        ياسر شمس الدين
      </text>
      <path
        d="M 12 62 C 52 40, 78 84, 116 62 S 178 40, 210 66"
        fill="none"
        stroke="#123b46"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M 44 74 C 82 66, 134 80, 186 72"
        fill="none"
        stroke="#123b46"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

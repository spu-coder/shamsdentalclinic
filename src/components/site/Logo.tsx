import logo from "@/assets/shams-logo.jpg.asset.json";

export function Logo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="شعار عيادة شمس السنية التخصصية"
      className={`${className} rounded-xl object-cover shadow-soft`}
      loading="eager"
    />
  );
}

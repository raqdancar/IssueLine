import CharacterShowcase from '@/components/home/CharacterShowcase'
import CollectedEditionsShowcase from '@/components/home/CollectedEditionsShowcase'
import CollectorsSection from '@/components/home/CollectorsSection'
import GlobalStatsSection from '@/components/home/GlobalStatsSection'
import HomeHeroSection from '@/components/home/HomeHeroSection'
import HowItWorksSection from '@/components/home/HowItWorksSection'
import TimelinePreviewSection from '@/components/home/TimelinePreviewSection'

function HomePage({ heroes, heroesStatus }) {
  return (
    <div className="bg-white">
      <HomeHeroSection heroes={heroes} />
      <CharacterShowcase heroes={heroes} heroesStatus={heroesStatus} />
      <TimelinePreviewSection />
      <HowItWorksSection />
      <CollectorsSection />
      <GlobalStatsSection heroes={heroes} heroesStatus={heroesStatus} />
      <CollectedEditionsShowcase />
    </div>
  )
}

export default HomePage

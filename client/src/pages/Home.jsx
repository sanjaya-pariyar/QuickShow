import React from 'react'
import HeroSection from '../components/HeroSection'
import FeaturedSection from '../components/FeaturedSection'
import TrailerSection from '../components/TrailerSection'
import RecommendedMovies from '../components/RecommendedMovies'

const Home = () => {
  return (
    <>
      <HeroSection />
      <FeaturedSection />
      <RecommendedMovies />
      <TrailerSection />
    </>
  )
}

export default Home

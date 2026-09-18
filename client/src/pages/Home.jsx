import React from 'react'
import HeroSection from '../components/HeroSection'
import FeaturedSection from '../components/FeaturedSection'
import TrailerSection from '../components/TrailerSection'
import RecommendedMovies from '../components/RecommendedMovies'
import CollaborativeRecommendedMovies from '../components/CollaborativeRecommendedMovies'

const Home = () => {
  return (
    <>
      <HeroSection />
      <FeaturedSection />
      <RecommendedMovies />
      <CollaborativeRecommendedMovies />
      <TrailerSection />
    </>
  )
}

export default Home

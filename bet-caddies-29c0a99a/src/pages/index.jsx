import Layout from "./Layout.jsx";

import Admin from "./Admin";

import BirdieBets from "./BirdieBets";

import EagleBets from "./EagleBets";

import HIOChallenge from "./HIOChallenge";

import Home from "./Home";

import Join from "./Join";

import LongShots from "./LongShots";

import LiveBetTracking from "./LiveBetTracking";


import Memberships from "./Memberships";

import MyBets from "./MyBets";

import ParBets from "./ParBets";

import Profile from "./Profile";

import Results from "./Results";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Admin: Admin,
    
    BirdieBets: BirdieBets,
    
    EagleBets: EagleBets,
    
    HIOChallenge: HIOChallenge,
    
    Home: Home,
    
    Join: Join,

    LongShots: LongShots,

    LiveBetTracking: LiveBetTracking,

    
    Memberships: Memberships,
    
    MyBets: MyBets,
    
    ParBets: ParBets,
    
    Profile: Profile,
    
    Results: Results,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/BirdieBets" element={<BirdieBets />} />
                
                <Route path="/EagleBets" element={<EagleBets />} />
                
                <Route path="/HIOChallenge" element={<HIOChallenge />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/Join" element={<Join />} />

                <Route path="/LongShots" element={<LongShots />} />

                <Route path="/LiveBetTracking" element={<LiveBetTracking />} />

                <Route path="/Memberships" element={<Memberships />} />
                
                <Route path="/MyBets" element={<MyBets />} />
                
                <Route path="/ParBets" element={<ParBets />} />
                
                <Route path="/Profile" element={<Profile />} />
                
                <Route path="/Results" element={<Results />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
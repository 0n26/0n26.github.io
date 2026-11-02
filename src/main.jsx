import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { profile, projects, filters, stack, filterProjects } from './data.js';
import './styles.css';
import Mascot from './Mascot.jsx';
import TargetCursor from './TargetCursor.jsx';
const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;
function Arrow({diagonal=false}) { return <span aria-hidden="true">{diagonal ? '↗' : '↗'}</span>; }
function App() {
  const [filter, setFilter] = useState('all');
  const [projectSignal, setProjectSignal] = useState(0);
  const noticeProject = () => setProjectSignal(value => value + 1);
  const visible = filterProjects(filter);
  return <>
    <a className="skip" href="#main">Перейти к содержимому</a>
    <header className="header wrap">
      <a className="brand" href="#top" aria-label="0n26 — наверх" data-cursor-label="0n26"><img src={asset('favicon.svg')} alt="" width="32" height="32"/><span>{profile.handle}<span className="brand-dot">.</span></span></a>
      <nav aria-label="Основная навигация"><a href="#projects" data-cursor-label="Проекты">Проекты</a><a href="#stack" data-cursor-label="Стек">Стек</a><a className="nav-github" href={profile.github} data-cursor-label="GitHub">GitHub <Arrow/></a></nav>
    </header>
    <main id="main">
      <section className="hero wrap" id="top" aria-labelledby="hero-title">
        <div className="hero-copy"><p className="eyebrow"><span className="square"/> ЛИЧНЫЙ АРХИВ / ИЗБРАННОЕ</p>
          <h1 id="hero-title"><span className="sr-only">0n26</span><img src={asset('wordmark.svg')} alt="" width="465" height="160"/></h1>
          <p className="hero-heading">{profile.intro}</p><p className="hero-description">{profile.description}</p>
          <div className="hero-actions"><a className="button" href="#projects" data-cursor-label="Проекты">Смотреть проекты <span aria-hidden="true">↓</span></a><a className="text-link" href={profile.github} data-cursor-label="GitHub">Профиль GitHub <Arrow/></a></div>
        </div>
        <div className="hero-art" aria-hidden="true"><span className="diagram-label">0n26 / SYSTEM MAP</span><img src={asset('orbit.svg')} alt="" width="500" height="420"/><span className="diagram-caption">СВЯЗИ МЕЖДУ ИДЕЯМИ И КОДОМ</span></div>
        <div className="hero-bottom"><span>ОТ МОДУЛЯ ДО МОДИФИКАЦИИ</span><span>SCROLL TO EXPLORE <span aria-hidden="true">↓</span></span></div>
      </section>
      <section className="projects-section wrap" id="projects" aria-labelledby="projects-heading">
        <div className="section-heading"><div><p className="eyebrow">01 / ПРОЕКТЫ</p><h2 id="projects-heading">Собрано в коде<span className="accent">.</span></h2></div><p className="section-caption">Небольшая подборка.<br/>Подробности и исходники внутри.</p></div>
        <div className="project-toolbar"><div className="filters" role="group" aria-label="Фильтр проектов">{filters.map(f => <button key={f.id} aria-pressed={filter===f.id} onClick={() => { setFilter(f.id); noticeProject(); }}>{f.label}<span aria-hidden="true">{f.id==='all' ? projects.length : filterProjects(f.id).length}</span></button>)}</div><p className="result-count" role="status" aria-live="polite">Показано: {visible.length} из {projects.length}</p></div>
        <div className="project-grid">{visible.map(p => <article className="project-card" key={p.id} onMouseEnter={noticeProject} onFocus={noticeProject}>
          <div className="card-image"><span className="card-number">/{p.number}</span><img src={asset(p.art)} alt="" width="560" height="280"/><span className="card-type">{p.type}</span></div>
          <div className="card-body"><div className="card-title"><h3><a href={p.url} data-cursor-label="GitHub">{p.name}<span className="sr-only"> — репозиторий на GitHub</span></a></h3><span className="card-arrow" aria-hidden="true">↗</span></div><p className="card-description">{p.description}</p><ul className="tags" aria-label="Технологии">{p.tags.map(tag => <li key={tag}>{tag}</li>)}</ul><p className="card-note">{p.note}</p></div>
        </article>)}</div>
        <a className="all-repos" href={`${profile.github}?tab=repositories`} data-cursor-label="GitHub"><span>Больше в репозиториях</span><span>github.com/0n26 <Arrow/></span></a>
      </section>
      <section className="stack-section wrap" id="stack" aria-labelledby="stack-heading"><div className="stack-intro"><p className="eyebrow">02 / ИНСТРУМЕНТЫ</p><h2 id="stack-heading">За проектами</h2><p>Технологии и среды,<br/>из которых складываются проекты.</p></div><div className="stack-list">{stack.map(item => <div className="stack-row" key={item.title}><span className="stack-number">{item.number}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><span className="stack-tags">{item.tags}</span></div>)}</div></section>
      <section className="closing wrap" aria-label="Исходный код"><p className="eyebrow">КОД ОСТАЁТСЯ ОТКРЫТЫМ</p><a href={profile.github} data-cursor-label="GitHub">Продолжение на GitHub<span aria-hidden="true">↗</span></a></section>
    </main>
    <footer className="footer wrap"><span>0n26 <span className="muted">/ Код. Инструменты. Моды.</span></span><a href="#top" data-cursor-label="Наверх">Наверх ↑</a></footer>
    <TargetCursor />
    <Mascot projectSignal={projectSignal}/>
  </>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);

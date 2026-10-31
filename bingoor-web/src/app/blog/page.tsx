'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { BlogPost, fetchBlogPosts } from '../../api/catalog';

import s from '../static.module.css';

const day = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function Page() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    fetchBlogPosts(page)
      .then((r) => {
        setPosts((cur) => (page === 1 ? r.items : [...(cur ?? []), ...r.items]));
        setPages(r.totalPages);
      })
      .catch(() => setPosts((cur) => cur ?? []));
  }, [page]);

  return (
    <div className={`page rise ${s.wrap}`}>
      <h1 className="h1">Blog</h1>
      <p className="body-sm" style={{ margin: '4px 0 22px' }}>Stories from the Bingoor kitchen, shelves and neighbourhood.</p>
      {posts === null ? (
        <p className="body-sm">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="body-sm">New posts are on their way. Check back soon.</p>
      ) : (
        <div className={s.grid}>
          {posts.map((p) => (
            <Link key={p._id} href={`/blog/${p.slug}`} className="card" style={{ overflow: 'hidden', display: 'block' }}>
              {p.cover ? <img src={p.cover} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} /> : null}
              <div className="card-pad">
                <h2 className="h3">{p.title}</h2>
                {p.excerpt ? <p className="body-sm" style={{ marginTop: 8 }}>{p.excerpt}</p> : null}
                <span className="body-sm" style={{ display: 'block', marginTop: 8 }}>
                  {[p.author, day(p.publishedAt)].filter(Boolean).join(' · ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {page < pages ? (
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setPage(page + 1)}>
            Show more
          </button>
        </div>
      ) : null}
    </div>
  );
}

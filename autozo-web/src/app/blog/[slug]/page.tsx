'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { BlogPost, fetchBlogPost } from '../../../api/catalog';
import { RichText } from '../../../components/RichText';

import s from '../../static.module.css';

export default function Page() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetchBlogPost(slug)
      .then((p) => {
        setPost(p);
        document.title = `${p.title} | Bingoor`;
      })
      .catch(() => setMissing(true));
  }, [slug]);

  return (
    <div className={`page rise ${s.wrap}`} style={{ maxWidth: 760 }}>
      <Link href="/blog" className="body-sm">
        ← All posts
      </Link>
      {missing ? (
        <p className="body-sm" style={{ marginTop: 16 }}>This post is not available.</p>
      ) : !post ? (
        <p className="body-sm" style={{ marginTop: 16 }}>Loading…</p>
      ) : (
        <article style={{ marginTop: 12 }}>
          <h1 className="h1">{post.title}</h1>
          <p className="body-sm" style={{ margin: '6px 0 18px' }}>
            {[post.author, post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''].filter(Boolean).join(' · ')}
          </p>
          {post.cover ? <img src={post.cover} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 18 }} /> : null}
          <RichText text={post.body ?? ''} />
        </article>
      )}
    </div>
  );
}

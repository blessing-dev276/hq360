import { load } from 'cheerio';
import { z } from 'zod';
import type { DiscoveredBookCandidate, SourceAdapter } from '../../adapters/types';
import { parsePublicBook } from '../public-pages/parse';
const authorSchema=z.object({name:z.string().min(1),uuid:z.string().optional(),has_public_profile:z.boolean().optional(),profile:z.object({about:z.string().nullable().optional(),profile_path:z.string().nullable().optional()}).optional()});
const bookSchema=z.object({title:z.string().min(1),url:z.string(),author:authorSchema,cover_url:z.string().optional(),cover:z.object({large:z.string().optional(),url:z.string().optional()}).optional(),publication_date:z.string().nullable().optional(),publisher_name:z.string().nullable().optional(),genre:z.object({name:z.string()}).optional(),review:z.object({verdict:z.object({rating:z.number().min(0).max(5)}).optional(),hidden:z.boolean().optional()}).nullable().optional(),removed:z.boolean().optional(),canceled:z.boolean().optional()});
export function reedsyUrl(value:string,kind:'book'|'profile'='book') {
 const url=new URL(value,'https://reedsy.com');
 const prefix=kind==='book'?'/discovery/book/':'/discovery/user/';
 if(url.protocol!=='https:'||url.hostname!=='reedsy.com'||url.port||url.username||url.password||!url.pathname.startsWith(prefix))throw new Error('Unexpected Reedsy public URL');
 url.hash='';url.search='';return url.toString();
}
function publicDocument(html:string){const $=load(html);const exclusions=$('meta[name="robots"],meta[name="HQ360Scout"]').map((_,e)=>$(e).attr('content')??'').get().join(',');if(/\b(noindex|none)\b/i.test(exclusions))throw new Error('Page excludes collection');return $;}
export function parseReedsyListing(html:string,genre:string):{books:DiscoveredBookCandidate[];followLinks:boolean}{
 const $=publicDocument(html);
 const raw=$('d-featured-page').attr(':genre-groups');
 if(!raw)throw new Error('Reedsy genre listing changed; no authors were guessed.');
 const groups=z.array(z.object({name:z.string(),books:z.array(z.unknown())})).parse(JSON.parse(raw));
 const group=groups.find(g=>g.name.toLowerCase()===genre.toLowerCase());
 if(!group)throw new Error(`Reedsy has no featured listing for ${genre} right now.`);
 const books:DiscoveredBookCandidate[]=[];
 for(const item of group.books){const parsed=bookSchema.safeParse(item);if(!parsed.success)continue;const book=parsed.data;
 if(book.removed||book.canceled)continue;
 books.push({title:book.title,authorName:book.author.name,sourceUrl:reedsyUrl(book.url),genre:group.name,coverImageUrl:book.cover_url,rawData:{author_source_id:book.author.uuid??null,listing_url:'https://reedsy.com/discovery',listing_genre:group.name}});
 }
 if(group.books.length&&!books.length)throw new Error('Reedsy book listing format changed.');
 return {books,followLinks:!(/\b(nofollow|none)\b/i.test($('meta[name="robots"]').attr('content')??''))};
}
export function parseReedsyBook(html:string,listing:DiscoveredBookCandidate):DiscoveredBookCandidate|null{
 const $=publicDocument(html);const raw=$('d-book-page').attr(':book');
 if(!raw){const structured=parsePublicBook(html,listing.sourceUrl!);if(!structured)throw new Error('Reedsy book page format changed.');
 if(structured.authorName.trim().toLowerCase()!==listing.authorName.trim().toLowerCase())throw new Error('Author differs from Reedsy listing');
 return {...listing,...structured,genre:listing.genre,rawData:{...listing.rawData,parsing:'schema.org / semantic HTML'}};}
 const book=bookSchema.parse(JSON.parse(raw));
 if(book.removed||book.canceled)return null;
 if(reedsyUrl(book.url)!==listing.sourceUrl)throw new Error('Reedsy book URL differs from listing');
 if(book.author.name.trim().toLowerCase()!==listing.authorName.trim().toLowerCase())throw new Error('Author differs from Reedsy listing');
 const profile=book.author.has_public_profile?book.author.profile:undefined;
 return {...listing,title:book.title,authorName:book.author.name,authorProfileUrl:profile?.profile_path?reedsyUrl(profile.profile_path,'profile'):undefined,
 bio:profile?.about??undefined,publicationDate:book.publication_date??undefined,publisher:book.publisher_name??undefined,
 coverImageUrl:book.cover?.large??book.cover?.url??listing.coverImageUrl,categories:book.genre?[listing.genre!,book.genre.name]:[listing.genre!],
 // An editorial verdict is not an aggregate rating or a review-count estimate.
 rawData:{...listing.rawData,author_source_id:book.author.uuid??null,editorial_rating:book.review?.hidden?null:book.review?.verdict?.rating??null,subgenre:book.genre?.name??null}};
}
export const reedsyAdapter:SourceAdapter={slug:'reedsy_discovery',async discover(query){
 if(!query.genre||!query.fetchPage)throw new Error('Reedsy requires a genre and the controlled public-page fetcher.');
 if(query.offset)return [];
 const listing=parseReedsyListing(await query.fetchPage('https://reedsy.com/discovery'),query.genre);
 const unique=[...new Map(listing.books.map(b=>[b.sourceUrl,b])).values()].slice(0,Math.min(query.maxResults??20,20));
 if(!listing.followLinks)return unique;
 const books:DiscoveredBookCandidate[]=[];
 for(const book of unique){const parsed=parseReedsyBook(await query.fetchPage(book.sourceUrl!),book);if(parsed)books.push(parsed);}
 return books;
}};
